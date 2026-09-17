import { apiPath } from "./env";

export type ActivityJob = {
  jobId: string;
  itemId: string;
  mode: string;
  status: string;
  progress?: string;
  fitment?: string;
  images?: string;
  duration?: string;
  date: string;
};

export type ActivitySummary = {
  listingsToday: number;
  totalListings: number;
  hoursSaved: number;
  successRate: number | null;
  jobs: ActivityJob[];
};

export async function fetchActivity(): Promise<ActivitySummary> {
  const empty: ActivitySummary = {
    listingsToday: 0,
    totalListings: 0,
    hoursSaved: 0,
    successRate: null,
    jobs: [],
  };
  try {
    const response = await fetch(apiPath("/me/activity"), {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      return empty;
    }
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      payload.ok === true &&
      "data" in payload &&
      payload.data &&
      typeof payload.data === "object"
    ) {
      const data = payload.data as Partial<ActivitySummary>;
      return {
        listingsToday: Number(data.listingsToday ?? 0),
        totalListings: Number(data.totalListings ?? 0),
        hoursSaved: Number(data.hoursSaved ?? 0),
        successRate: data.successRate ?? null,
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    }
    return empty;
  } catch {
    return empty;
  }
}
