import { useEffect, useState } from "react";
import { AdminCard, AdminConfirm, AdminPageHeader, AdminTabs, ErrorState, LoadingSkeleton, PrimaryButton } from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { adminGet, adminSend } from "../../lib/admin-api";

type Settings = {
  marketplace: string;
  progressRetentionDays: number;
  scraperConcurrency: number;
  jobTimeoutSeconds: number;
  retryAttempts: number;
  perUserJobRateLimit: number;
  ipRateLimit: number;
  concurrentJobsPerUser: number;
  features: { fullScrapeEnabled: boolean; fitmentOnlyEnabled: boolean; registrationEnabled: boolean };
  maintenance: { enabled: boolean; message: string };
};

export function AdminSettingsPage() {
  const toast = useAdminToast();
  const [tab, setTab] = useState("General");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [originalMaintenance, setOriginalMaintenance] = useState(false);

  useEffect(() => {
    void adminGet<Settings>("/api/v1/admin/settings")
      .then((next) => {
        setSettings(next);
        setOriginalMaintenance(next.maintenance.enabled);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, []);

  async function persist(next: Settings) {
    try {
      const saved = await adminSend<Settings>("/api/v1/admin/settings", "PATCH", next);
      setSettings(saved);
      setOriginalMaintenance(saved.maintenance.enabled);
      toast("Settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!settings) return <LoadingSkeleton />;

  return (
    <div>
      <AdminPageHeader
        title="System Settings"
        actions={
          <PrimaryButton
            onClick={() => {
              if (settings.maintenance.enabled !== originalMaintenance) {
                setConfirm(true);
                return;
              }
              void persist(settings);
            }}
          >
            Save Changes
          </PrimaryButton>
        }
      />
      <AdminTabs tabs={["General", "Scraping", "Limits", "Features", "Maintenance"]} value={tab} onChange={setTab} />
      <AdminCard>
        {tab === "General" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">Marketplace
              <input value={settings.marketplace} onChange={(event) => setSettings({ ...settings, marketplace: event.target.value })} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
            </label>
            <Num label="Progress retention (days)" value={settings.progressRetentionDays} onChange={(value) => setSettings({ ...settings, progressRetentionDays: value })} />
          </div>
        ) : null}
        {tab === "Scraping" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Num label="Scraper concurrency" value={settings.scraperConcurrency} onChange={(value) => setSettings({ ...settings, scraperConcurrency: value })} />
            <Num label="Job timeout (seconds)" value={settings.jobTimeoutSeconds} onChange={(value) => setSettings({ ...settings, jobTimeoutSeconds: value })} />
            <Num label="Retry attempts" value={settings.retryAttempts} onChange={(value) => setSettings({ ...settings, retryAttempts: value })} />
          </div>
        ) : null}
        {tab === "Limits" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Num label="Per-user job rate limit" value={settings.perUserJobRateLimit} onChange={(value) => setSettings({ ...settings, perUserJobRateLimit: value })} />
            <Num label="IP rate limit" value={settings.ipRateLimit} onChange={(value) => setSettings({ ...settings, ipRateLimit: value })} />
            <Num label="Concurrent jobs per user" value={settings.concurrentJobsPerUser} onChange={(value) => setSettings({ ...settings, concurrentJobsPerUser: value })} />
          </div>
        ) : null}
        {tab === "Features" ? (
          <div className="space-y-3">
            <Toggle label="Full scrape enabled" checked={settings.features.fullScrapeEnabled} onChange={(checked) => setSettings({ ...settings, features: { ...settings.features, fullScrapeEnabled: checked } })} />
            <Toggle label="Fitment only enabled" checked={settings.features.fitmentOnlyEnabled} onChange={(checked) => setSettings({ ...settings, features: { ...settings.features, fitmentOnlyEnabled: checked } })} />
            <Toggle label="Registration enabled" checked={settings.features.registrationEnabled} onChange={(checked) => setSettings({ ...settings, features: { ...settings.features, registrationEnabled: checked } })} />
          </div>
        ) : null}
        {tab === "Maintenance" ? (
          <div className="space-y-3">
            <Toggle label="Maintenance mode" checked={settings.maintenance.enabled} onChange={(checked) => setSettings({ ...settings, maintenance: { ...settings.maintenance, enabled: checked } })} />
            <label className="block text-sm">Message
              <input value={settings.maintenance.message} onChange={(event) => setSettings({ ...settings, maintenance: { ...settings.maintenance, message: event.target.value } })} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
            </label>
          </div>
        ) : null}
      </AdminCard>
      <AdminConfirm
        open={confirm}
        title="Change maintenance mode?"
        message="This affects new background scrape jobs for normal users. The Chrome extension sync scrape path is unchanged."
        confirmLabel="Confirm"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void persist(settings);
        }}
      />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">{label}
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
