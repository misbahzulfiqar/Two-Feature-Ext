import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DarkCard } from "../components/LayoutBits";
import { apiPath } from "../lib/env";
import { useSessionUser } from "../lib/session";

type JobDetail = {
  jobId: string;
  itemId: string;
  listingUrl: string;
  mode: string;
  status: string;
  marketplace: string;
  duration: string;
  itemSpecificCount: number;
  fitmentCount: number;
  imageCount: number;
  warningCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: {
    title?: string;
    sku?: string;
    price?: string;
    condition?: string;
    conditionDescription?: string;
    category?: { name?: string; path?: string[] };
    storeCategories?: Array<{ name?: string }>;
    shipping?: { service?: string; cost?: string; handlingTime?: string; location?: string };
    weight?: { value?: string; unit?: string };
    dimensions?: { raw?: string; length?: string; width?: string; height?: string; unit?: string };
    itemSpecifics?: Array<{ key?: string; value?: string }>;
    images?: string[];
  } | null;
};

export function HistoryJobPage() {
  const { jobId } = useParams();
  const { name, email } = useSessionUser();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setMissing(true);
      return;
    }
    void fetch(apiPath(`/me/jobs/${encodeURIComponent(jobId)}`), {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const payload: unknown = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "ok" in payload &&
          payload.ok === true &&
          "data" in payload
        ) {
          setJob(payload.data as JobDetail);
        } else {
          setMissing(true);
        }
      })
      .catch(() => setMissing(true));
  }, [jobId]);

  return (
    <AppShell name={name} email={email}>
      <DarkCard>
        <h1 className="text-xl font-bold">Job {jobId}</h1>
        {job ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-mute">Item ID</dt>
              <dd className="font-medium">{job.itemId || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Status</dt>
              <dd className="font-medium">{job.status}</dd>
            </div>
            <div>
              <dt className="text-mute">Mode</dt>
              <dd className="font-medium">{job.mode}</dd>
            </div>
            <div>
              <dt className="text-mute">Marketplace</dt>
              <dd className="font-medium">{job.marketplace}</dd>
            </div>
            <div>
              <dt className="text-mute">Duration</dt>
              <dd className="font-medium">{job.duration}</dd>
            </div>
            <div>
              <dt className="text-mute">Fitment</dt>
              <dd className="font-medium">{job.fitmentCount}</dd>
            </div>
            <div>
              <dt className="text-mute">Images</dt>
              <dd className="font-medium">{job.imageCount}</dd>
            </div>
            <div>
              <dt className="text-mute">Item specifics</dt>
              <dd className="font-medium">{job.itemSpecificCount}</dd>
            </div>
            <div>
              <dt className="text-mute">Warnings</dt>
              <dd className="font-medium">{job.warningCount}</dd>
            </div>
            {job.result?.title ? (
              <div className="md:col-span-2">
                <dt className="text-mute">Title</dt>
                <dd className="font-medium">{job.result.title}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-mute">SKU</dt>
              <dd className="font-medium">{job.result?.sku || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Price</dt>
              <dd className="font-medium">{job.result?.price || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Condition</dt>
              <dd className="font-medium">{job.result?.condition || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Condition description</dt>
              <dd className="font-medium">{job.result?.conditionDescription || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Item category</dt>
              <dd className="font-medium">{job.result?.category?.path?.join(" > ") || job.result?.category?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Store category</dt>
              <dd className="font-medium">{job.result?.storeCategories?.map((item) => item.name).filter(Boolean).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Shipping</dt>
              <dd className="font-medium">{[job.result?.shipping?.service, job.result?.shipping?.cost].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Weight</dt>
              <dd className="font-medium">{[job.result?.weight?.value, job.result?.weight?.unit].filter(Boolean).join(" ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-mute">Dimensions</dt>
              <dd className="font-medium">{job.result?.dimensions?.raw || "—"}</dd>
            </div>
            {job.errorMessage ? (
              <div className="md:col-span-2">
                <dt className="text-mute">Error</dt>
                <dd className="font-medium">{job.errorMessage}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-mute">
            {missing
              ? "This job was not found for your account."
              : "Loading scrape record…"}
          </p>
        )}
      </DarkCard>
    </AppShell>
  );
}
