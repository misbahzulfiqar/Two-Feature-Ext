export type AdminRole = "user" | "admin";
export type UserStatus = "active" | "disabled";

export type AuthUserDoc = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export type AuditEventDoc = {
  event: string;
  userId?: string;
  userEmail?: string;
  jobId?: string;
  listingId?: string;
  targetId?: string;
  details: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  createdAt: Date;
};

export type UserSettingsDoc = {
  userId: string;
  preferences: {
    defaultScrapeMode: "full-scrape" | "only-fitment";
  };
  updatedAt: Date;
};

export type AdminSettingsDoc = {
  marketplace: string;
  progressRetentionDays: number;
  scraperConcurrency: number;
  jobTimeoutSeconds: number;
  retryAttempts: number;
  perUserJobRateLimit: number;
  ipRateLimit: number;
  concurrentJobsPerUser: number;
  features: {
    fullScrapeEnabled: boolean;
    fitmentOnlyEnabled: boolean;
    registrationEnabled: boolean;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  minimumSupportedExtension: string;
  updatedAt: Date;
};

export const DEFAULT_ADMIN_SETTINGS: AdminSettingsDoc = {
  marketplace: "US",
  progressRetentionDays: 30,
  scraperConcurrency: 2,
  jobTimeoutSeconds: 120,
  retryAttempts: 3,
  perUserJobRateLimit: 60,
  ipRateLimit: 120,
  concurrentJobsPerUser: 2,
  features: {
    fullScrapeEnabled: true,
    fitmentOnlyEnabled: true,
    registrationEnabled: true,
  },
  maintenance: {
    enabled: false,
    message: "",
  },
  minimumSupportedExtension: "1.0.0",
  updatedAt: new Date(0),
};

export const AUDIT_EVENTS_COLLECTION = "auditEvents";
export const SETTINGS_COLLECTION = "adminSettings";
export const USER_SETTINGS_COLLECTION = "settings";
export const SETTINGS_ID = "global";
export const USERS_COLLECTION = "user";
export const SESSIONS_COLLECTION = "session";
export const CRON_JOBS_COLLECTION = "cronJobs";
export const SCRAPE_JOBS_COLLECTION = "scrapeJobs";

export const WORKER_CONCURRENCY = 2;
export const API_VERSION = "0.0.0";
export const EXTENSION_VERSION = "1.0.0";
export const SCRAPER_VERSION = "0.0.0";
