import { Router, type Request, type Response } from "express";
import { loadAccounts, registerAccount, updateAccount, type PublicAccount } from "../accounts.js";

function sendData(res: Response, data: unknown): void {
  res.json({ ok: true, data });
}

function emptyPage(page: number, limit: number) {
  return { items: [], page, limit, total: 0, totalPages: 1 };
}

function activity(): Array<{ date: string; completed: number; failed: number; queued: number }> {
  const rows = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    rows.push({
      date: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      completed: 0,
      failed: 0,
      queued: 0,
    });
  }
  return rows;
}

function monthStart(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export function createAdminOverviewRouter(mongoUrl: string | undefined): Router {
  const router = Router();

  router.get("/dashboard", async (_req, res) => {
    const accounts = await loadAccounts(mongoUrl);
    const active = accounts.filter((account) => account.status === "active").length;
    sendData(res, {
      users: { total: accounts.length, active },
      jobs: { today: 0, total: 0, completed: 0, failed: 0, queued: 0, processing: 0 },
      activity: activity(),
      recentJobs: [],
    });
  });

  router.get("/users", async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 25);
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "all");
    const sort = String(req.query.sort ?? "latest");
    let accounts = (await loadAccounts(mongoUrl)).map(publicView);
    if (search) {
      accounts = accounts.filter(
        (account) =>
          account.name.toLowerCase().includes(search) || account.email.toLowerCase().includes(search),
      );
    }
    if (status === "active" || status === "disabled") {
      accounts = accounts.filter((account) => account.status === status);
    }
    accounts.sort((left, right) => {
      if (sort === "name") {
        return left.name.localeCompare(right.name);
      }
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
    const now = new Date();
    const all = (await loadAccounts(mongoUrl)).map(publicView);
    const start = (page - 1) * limit;
    sendData(res, {
      items: accounts.slice(start, start + limit),
      page,
      limit,
      total: accounts.length,
      totalPages: Math.max(1, Math.ceil(accounts.length / limit)),
      stats: {
        total: all.length,
        active: all.filter((account) => account.status === "active").length,
        disabled: all.filter((account) => account.status === "disabled").length,
        newThisMonth: all.filter((account) => Date.parse(account.createdAt) >= monthStart(now)).length,
      },
    });
  });

  router.post("/users", async (req, res) => {
    const body = readBody(req);
    const created = await registerAccount(mongoUrl, {
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role === "admin" ? "admin" : "user",
    });
    if (created.error || !created.account) {
      res.status(400).json({ ok: false, error: { code: "INVALID_REQUEST", message: created.error ?? "Could not create user" } });
      return;
    }
    sendData(res, created.account);
  });

  router.get("/users/:userId", async (req, res) => {
    const accounts = (await loadAccounts(mongoUrl)).map(publicView);
    const user = accounts.find((account) => account.id === req.params.userId);
    if (!user) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    sendData(res, {
      user,
      statistics: { totalJobs: 0, fullScrapes: 0, fitmentOnly: 0, successRate: null },
      recentJobs: [],
      activity: [{ event: "account_created", details: "Account created on the website", createdAt: user.createdAt }],
    });
  });

  router.patch("/users/:userId", async (req, res) => {
    const body = readBody(req);
    const user = await updateAccount(mongoUrl, String(req.params.userId), { name: body.name });
    if (!user) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    sendData(res, user);
  });

  router.patch("/users/:userId/status", async (req, res) => {
    const body = readBody(req);
    const status = body.status === "disabled" ? "disabled" : "active";
    const user = await updateAccount(mongoUrl, String(req.params.userId), { status });
    if (!user) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    sendData(res, user);
  });

  router.post("/users/:userId/password-reset", (_req, res) => {
    sendData(res, { sent: false });
  });

  router.get("/search", async (req, res) => {
    const query = String(req.query.q ?? "").trim().toLowerCase();
    const accounts = (await loadAccounts(mongoUrl)).map(publicView);
    const users = accounts
      .filter(
        (account) =>
          account.name.toLowerCase().includes(query) || account.email.toLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((account) => ({ id: account.id, name: account.name, email: account.email }));
    sendData(res, { users, jobs: [] });
  });

  router.get("/notifications", (_req, res) => {
    sendData(res, { items: [] });
  });

  router.get("/jobs", (req, res) => {
    sendData(res, emptyPage(Number(req.query.page) || 1, Number(req.query.limit) || 25));
  });

  router.get("/jobs/:jobId", (_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Job not found" } });
  });

  router.get("/audit", (req, res) => {
    sendData(res, emptyPage(Number(req.query.page) || 1, Number(req.query.limit) || 25));
  });

  router.get("/errors/summary", (_req, res) => {
    sendData(res, { total: 0, uniqueTypes: 0, critical: 0, thisWeek: 0, types: [] });
  });

  router.get("/workers", (_req, res) => {
    sendData(res, {
      configuredConcurrency: 1,
      workers: [],
      queue: {
        waiting: 0,
        active: 0,
        failed: 0,
        longestWaitMs: null,
        averageProcessingMs: null,
        oldestActiveMs: null,
        jobs: [],
      },
      stats: { activeWorkers: 0, queuedJobs: 0, processing: 0, failedJobs: 0 },
    });
  });

  router.get("/health", (_req, res) => {
    const online = { status: "online", latencyMs: 1 };
    sendData(res, {
      checkedAt: new Date().toISOString(),
      checks: {
        api: online,
        mongo: mongoUrl ? online : { status: "skipped", latencyMs: null, detail: "No database configured" },
        redis: { status: "skipped", latencyMs: null },
        scraperWorkers: online,
        agenda: { status: "skipped", latencyMs: null },
        extensionApi: online,
        storage: online,
      },
    });
  });

  router.get("/settings", (_req, res) => {
    sendData(res, defaultSettings());
  });

  router.patch("/settings", (req, res) => {
    const body = req.body;
    if (body && typeof body === "object") {
      sendData(res, { ...defaultSettings(), ...body });
      return;
    }
    sendData(res, defaultSettings());
  });

  router.get("/extensions", (_req, res) => {
    sendData(res, {
      currentExtension: "1.0.0",
      minimumSupported: "1.0.0",
      apiVersion: "1.0.0",
      scraperVersion: "1.0.0",
      selectorProfile: null,
      distribution: [{ version: "1.0.0", users: 0, percent: 100 }],
      outdatedUsers: 0,
    });
  });

  router.patch("/extensions/minimum-supported", (req, res) => {
    const body = readBody(req);
    sendData(res, { minimumSupported: body.minimumSupported || "1.0.0" });
  });

  router.get("/profile", (req, res) => {
    const email = String(req.header("x-admin-email") ?? "admin@local");
    const name = String(req.header("x-admin-name") ?? email.split("@")[0] ?? "Admin");
    sendData(res, {
      user: { id: "admin", name, email, role: "admin", lastLogin: new Date().toISOString() },
      sessions: [],
      activity: [],
    });
  });

  router.patch("/profile", (req, res) => {
    const body = readBody(req);
    const email = String(req.header("x-admin-email") ?? "admin@local");
    sendData(res, {
      user: {
        id: "admin",
        name: body.name || email.split("@")[0],
        email,
        role: "admin",
        lastLogin: new Date().toISOString(),
      },
      sessions: [],
      activity: [],
    });
  });

  return router;
}

function publicView(account: PublicAccount): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    jobs: account.jobs,
    lastActive: account.lastActive,
  };
}

function readBody(req: Request): {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  minimumSupported: string;
} {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return { name: "", email: "", password: "", role: "user", status: "", minimumSupported: "" };
  }
  const row = body as Record<string, unknown>;
  return {
    name: typeof row.name === "string" ? row.name : "",
    email: typeof row.email === "string" ? row.email : "",
    password: typeof row.password === "string" ? row.password : "",
    role: typeof row.role === "string" ? row.role : "user",
    status: typeof row.status === "string" ? row.status : "",
    minimumSupported: typeof row.minimumSupported === "string" ? row.minimumSupported : "",
  };
}

function defaultSettings() {
  return {
    marketplace: "ebay",
    progressRetentionDays: 7,
    scraperConcurrency: 1,
    jobTimeoutSeconds: 120,
    retryAttempts: 1,
    perUserJobRateLimit: 30,
    ipRateLimit: 60,
    concurrentJobsPerUser: 2,
    features: { fullScrapeEnabled: true, fitmentOnlyEnabled: true, registrationEnabled: true },
    maintenance: { enabled: false, message: "" },
  };
}
