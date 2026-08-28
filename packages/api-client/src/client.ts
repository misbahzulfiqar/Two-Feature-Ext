import type {
  ApiResponse,
  GetListingResponse,
  HealthResponse,
  ListingId,
  SellSimilarRequest,
  SellSimilarResponse,
} from "@sell-similar/contracts";
import { sellSimilarRequestSchema } from "@sell-similar/validation";

export type SellSimilarApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  getCorrelationId?: () => string | undefined;
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

export class SellSimilarApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getCorrelationId?: () => string | undefined;

  constructor(options: SellSimilarApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.getCorrelationId = options.getCorrelationId;
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

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const correlationId = this.getCorrelationId?.();
    if (correlationId) {
      headers.set("x-correlation-id", correlationId);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new SellSimilarApiError(response.status, payload);
    }
    return payload as T & ApiResponse<unknown>;
  }
}
