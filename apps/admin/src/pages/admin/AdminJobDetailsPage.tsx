import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AdminCard,
  AdminConfirm,
  AdminPageHeader,
  AdminStatCard,
  AdminTabs,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PrimaryButton,
  StatusBadge,
} from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { useAdminPolling } from "../../hooks/use-admin-polling";
import { adminGet, adminSend, type AdminJob } from "../../lib/admin-api";
import { formatAdminDateTime, modeLabel } from "../../lib/admin-format";

type Detail = {
  job: AdminJob;
  summary: { itemSpecifics: number; fitmentRecords: number; images: number; applyWarnings: number };
  source: { title: string | null; thumbnail: string | null; itemId: string; ebayUrl: string | null };
};

type Result = {
  listing: {
    title: string | null;
    sku: string | null;
    price: string | null;
    condition: string | null;
    conditionDescription?: string | null;
    category?: { name?: string; path?: string[] } | null;
    storeCategories?: Array<{ name?: string }>;
    shipping?: { service?: string; cost?: string; handlingTime?: string; location?: string } | null;
    weight?: { value?: string; unit?: string } | null;
    dimensions?: { length?: string; width?: string; height?: string; unit?: string; raw?: string } | null;
    description: string | null;
  } | null;
  itemSpecifics: Array<{ key?: string; value?: string }>;
  fitment: unknown[];
  images: Array<{ imageId?: string; url: string; ebayImageId?: string; position?: number } | string>;
  warnings: string[];
};

type Events = { events: Array<{ timestamp: string; stage: string; progress: number; message: string; detail: string }> };

export function AdminJobDetailsPage() {
  const { jobId = "" } = useParams();
  const toast = useAdminToast();
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Detail | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [events, setEvents] = useState<Events["events"]>([]);
  const [error, setError] = useState("");
  const [retryOpen, setRetryOpen] = useState(false);

  const load = useCallback(() => {
    void adminGet<Detail>(`/api/v1/admin/jobs/${jobId}`)
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load job"));
    void adminGet<Result>(`/api/v1/admin/jobs/${jobId}/result`).then(setResult).catch(() => undefined);
    void adminGet<Events>(`/api/v1/admin/jobs/${jobId}/events`).then((next) => setEvents(next.events)).catch(() => undefined);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);
  useAdminPolling(load, 1500, data?.job.status === "processing" || data?.job.status === "queued");

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={8} />;

  return (
    <div>
      <Link to="/admin/jobs" className="text-sm text-mute">
        ← Back to Jobs
      </Link>
      <AdminPageHeader
        title={`Job #${data.job.jobId.slice(0, 8)}`}
        subtitle={formatAdminDateTime(data.job.createdAt)}
        actions={
          <>
            <StatusBadge status={data.job.status} />
            {data.job.retryable ? <PrimaryButton onClick={() => setRetryOpen(true)}>Retry Job</PrimaryButton> : null}
          </>
        }
      />
      <AdminTabs tabs={["Overview", "Extracted Data", "Progress Logs", "Errors & Warnings"]} value={tab} onChange={setTab} />
      {tab === "Overview" ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <AdminCard>
            <h3 className="mb-3 font-bold">Job Information</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-faint">Job ID</dt><dd>{data.job.jobId}</dd></div>
              <div><dt className="text-faint">User</dt><dd>{data.job.user?.email ?? "—"}</dd></div>
              <div><dt className="text-faint">Source Item ID</dt><dd>{data.job.sourceItemId || "—"}</dd></div>
              <div><dt className="text-faint">Mode</dt><dd>{modeLabel(data.job.mode)}</dd></div>
              <div><dt className="text-faint">Status</dt><dd><StatusBadge status={data.job.status} /></dd></div>
              <div><dt className="text-faint">Created At</dt><dd>{formatAdminDateTime(data.job.createdAt)}</dd></div>
              <div><dt className="text-faint">Started At</dt><dd>{formatAdminDateTime(data.job.startedAt)}</dd></div>
              <div><dt className="text-faint">Completed At</dt><dd>{formatAdminDateTime(data.job.completedAt)}</dd></div>
              <div><dt className="text-faint">Duration</dt><dd>{data.job.duration}</dd></div>
            </dl>
          </AdminCard>
          <div className="space-y-4">
            <AdminCard>
              <h3 className="mb-3 font-bold">Results Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <AdminStatCard label="Item Specifics" value={data.summary.itemSpecifics} />
                <AdminStatCard label="Fitment Records" value={data.summary.fitmentRecords} />
                <AdminStatCard label="Images" value={data.summary.images} />
                <AdminStatCard label="Apply Warnings" value={data.summary.applyWarnings} tone="warn" />
              </div>
            </AdminCard>
            <AdminCard>
              <h3 className="mb-3 font-bold">Source Listing</h3>
              <div className="flex gap-3">
                {data.source.thumbnail ? <img src={data.source.thumbnail} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null}
                <div>
                  <p className="font-medium">{data.source.title ?? "Source listing"}</p>
                  <p className="text-sm text-mute">{data.source.itemId || "—"}</p>
                  {data.source.ebayUrl ? (
                    <a className="mt-2 inline-block text-sm text-violet-bright" href={data.source.ebayUrl} target="_blank" rel="noreferrer">
                      Open on eBay
                    </a>
                  ) : null}
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      ) : null}
      {tab === "Extracted Data" ? (
        <div className="space-y-4">
          <AdminCard>
            <h3 className="mb-2 font-bold">Listing Details</h3>
            {result?.listing ? (
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div>Title: {result.listing.title ?? "—"}</div>
                <div>SKU: {result.listing.sku ?? "—"}</div>
                <div>Price: {result.listing.price ?? "—"}</div>
                <div>Condition: {result.listing.condition ?? "—"}</div>
                <div>Condition description: {result.listing.conditionDescription ?? "—"}</div>
                <div>Category: {result.listing.category?.path?.join(" > ") || result.listing.category?.name || "—"}</div>
                <div>Store category: {result.listing.storeCategories?.map((item) => item.name).filter(Boolean).join(", ") || "—"}</div>
                <div>Shipping: {result.listing.shipping?.service || result.listing.shipping?.cost || "—"}</div>
                <div>Weight: {[result.listing.weight?.value, result.listing.weight?.unit].filter(Boolean).join(" ") || "—"}</div>
                <div>Dimensions: {result.listing.dimensions?.raw || "—"}</div>
              </dl>
            ) : (
              <EmptyState message="No extracted listing details." />
            )}
          </AdminCard>
          <AdminCard>
            <h3 className="mb-2 font-bold">Item Specifics</h3>
            {result?.itemSpecifics.length ? result.itemSpecifics.map((item) => (
              <p key={`${item.key}-${item.value}`} className="text-sm">{item.key}: {item.value}</p>
            )) : <EmptyState message="No item specifics." />}
          </AdminCard>
          <AdminCard>
            <h3 className="mb-2 font-bold">Fitment</h3>
            <p className="text-sm text-mute">{Array.isArray(result?.fitment) ? `${result.fitment.length} records` : "—"}</p>
          </AdminCard>
          <AdminCard>
            <h3 className="mb-2 font-bold">Images</h3>
            <div className="flex flex-wrap gap-2">
              {(result?.images ?? []).slice(0, 12).map((image) => {
                const src = typeof image === "string" ? image : image.url;
                const key = typeof image === "string" ? image : image.imageId ?? image.url;
                return <img key={key} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />;
              })}
              {(result?.images.length ?? 0) === 0 ? <EmptyState message="No images." /> : null}
            </div>
          </AdminCard>
        </div>
      ) : null}
      {tab === "Progress Logs" ? (
        <AdminCard>
          {events.length === 0 ? <EmptyState message="No progress events recorded." /> : (
            <ul className="space-y-3 text-sm">
              {events.map((event) => (
                <li key={`${event.timestamp}-${event.stage}`} className="border-b border-line pb-2">
                  <p className="font-medium">{event.stage} · {event.progress}%</p>
                  <p className="text-mute">{event.message}</p>
                  <p className="text-xs text-faint">{formatAdminDateTime(event.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      ) : null}
      {tab === "Errors & Warnings" ? (
        <AdminCard>
          {data.job.error || (result?.warnings.length ?? 0) > 0 ? (
            <ul className="space-y-2 text-sm">
              {data.job.error ? <li className="text-danger">{data.job.error}</li> : null}
              {(result?.warnings ?? []).map((warning) => (
                <li key={warning} className="text-warn">{warning}</li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No errors recorded." />
          )}
        </AdminCard>
      ) : null}
      <AdminConfirm
        open={retryOpen}
        title="Retry this job?"
        message="A new scrape will be queued from the same source listing."
        confirmLabel="Retry Job"
        onCancel={() => setRetryOpen(false)}
        onConfirm={() => {
          void adminSend(`/api/v1/admin/jobs/${jobId}/retry`, "POST")
            .then(() => {
              toast("Job retry queued");
              setRetryOpen(false);
              load();
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Retry failed", "err"));
        }}
      />
    </div>
  );
}
