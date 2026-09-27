import type {
  ApiResponse,
  ClearScrapeCacheRequest,
  ClearScrapeCacheResponse,
  CreateScrapeJobRequest,
  CreateScrapeJobResponse,
  GetListingResponse,
  GetScrapeJobResponse,
  HealthResponse,
  ListingId,
  ScrapeListingRequest,
  ScrapeListingResponse,
  ScrapeProgressSnapshot,
  SellSimilarRequest,
  SellSimilarResponse,
} from "@sell-similar/contracts";
import {
  clearScrapeCacheRequestSchema,
  createScrapeJobRequestSchema,
  scrapeListingRequestSchema,
  sellSimilarRequestSchema,
} from "@sell-similar/validation";

export type SellSimilarApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  getCorrelationId?: () => string | undefined;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
};

export class SellSimilarApiError extends Error {
  override readonly name = "SellSimilarApiError";

  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

function globalFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}

export class SellSimilarApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getCorrelationId?: () => string | undefined;
  private readonly getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;

  constructor(options: SellSimilarApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalFetch;
    this.getCorrelationId = options.getCorrelationId;
    this.getHeaders = options.getHeaders;
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async getListing(listingId: ListingId): Promise<GetListingResponse> {
    return this.request<GetListingResponse>(
      `/listings/${encodeURIComponent(listingId)}`,
    );
  }

  async sellSimilar(
    input: SellSimilarRequest,
  ): Promise<SellSimilarResponse> {
    const body = sellSimilarRequestSchema.parse(input);
    return this.request<SellSimilarResponse>("/listings/sell-similar", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async scrapeListing(
    input: ScrapeListingRequest,
  ): Promise<ScrapeListingResponse> {
    const body = scrapeListingRequestSchema.parse(input);
    return this.request<ScrapeListingResponse>("/listings/scrape", {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  }

  /** Drop any cached scrape for one item so the next run hits eBay live. */
  async clearScrapeCache(
    input: ClearScrapeCacheRequest,
  ): Promise<ClearScrapeCacheResponse> {
    const body = clearScrapeCacheRequestSchema.parse(input);
    return this.request<ClearScrapeCacheResponse>("/listings/scrape-cache/clear", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Best-effort live progress via short-interval HTTP GET (no WebSocket). */
  async getScrapeProgress(): Promise<ApiResponse<ScrapeProgressSnapshot>> {
    return this.request<ApiResponse<ScrapeProgressSnapshot>>("/listings/scrape/progress");
  }

  async createScrapeJob(
    input: CreateScrapeJobRequest,
  ): Promise<CreateScrapeJobResponse> {
    const body = createScrapeJobRequestSchema.parse(input);
    return this.request<CreateScrapeJobResponse>("/listings/scrape-jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getScrapeJob(jobId: string): Promise<GetScrapeJobResponse> {
    return this.request<GetScrapeJobResponse>(
      `/listings/scrape-jobs/${encodeURIComponent(jobId)}`,
    );
  }

  async reportApplyResult(input: {
    jobId: string;
    fitmentCount?: number;
    imageCount?: number;
    warningCount: number;
    warnings?: string[];
  }): Promise<ApiResponse<{ jobId: string }>> {
    return this.request<ApiResponse<{ jobId: string }>>("/listings/apply-result", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const extra = this.getHeaders ? await this.getHeaders() : {};
    for (const [key, value] of Object.entries(extra)) {
      if (value) {
        headers.set(key, value);
      }
    }
    const correlationId = this.getCorrelationId?.();
    if (correlationId) {
      headers.set("x-correlation-id", correlationId);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const raw = await response.text();
    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 180);
      throw new SellSimilarApiError(response.status, {
        ok: false,
        error: {
          code: "API_NOT_JSON",
          message: snippet || `The API returned ${response.status} without JSON`,
        },
      });
    }
    if (!response.ok) {
      throw new SellSimilarApiError(response.status, payload);
    }
    return payload as T & ApiResponse<unknown>;
  }
}
