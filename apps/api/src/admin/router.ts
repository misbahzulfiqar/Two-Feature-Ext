import type { Auth } from "../auth.js";
import type { ApiEnv } from "../env.js";
import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { createAdminHandlers } from "./handlers.js";
import { createRequireAdmin } from "./require-admin.js";

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof ZodError) {
        res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: error.issues[0]?.message ?? "Invalid request" },
        });
        return;
      }
      next(error);
    });
  };
}

export function createAdminRouter(auth: Auth, env: ApiEnv): Router {
  const router = Router();
  const handlers = createAdminHandlers(auth, env);
  router.use(createRequireAdmin(auth));
  router.get("/dashboard", wrap(handlers.dashboard));
  router.get("/users", wrap(handlers.users));
  router.post("/users", wrap(handlers.createUser));
  router.get("/users/:userId", wrap(handlers.userDetail));
  router.patch("/users/:userId", wrap(handlers.patchUser));
  router.patch("/users/:userId/status", wrap(handlers.patchUserStatus));
  router.post("/users/:userId/password-reset", wrap(handlers.resetPassword));
  router.get("/jobs", wrap(handlers.jobs));
  router.get("/jobs/:jobId", wrap(handlers.jobDetail));
  router.get("/jobs/:jobId/result", wrap(handlers.jobResult));
  router.get("/jobs/:jobId/events", wrap(handlers.jobEvents));
  router.post("/jobs/:jobId/retry", wrap(handlers.retryJob));
  router.get("/audit", wrap(handlers.audit));
  router.get("/errors/summary", wrap(handlers.errorsSummary));
  router.get("/errors", wrap(handlers.errors));
  router.get("/errors/:code", wrap(handlers.errorDetail));
  router.get("/workers", wrap(handlers.workers));
  router.get("/health", wrap(handlers.health));
  router.get("/settings", wrap(handlers.settings));
  router.patch("/settings", wrap(handlers.patchSettings));
  router.get("/extensions", wrap(handlers.extensions));
  router.patch("/extensions/minimum-supported", wrap(handlers.patchMinimumExtension));
  router.get("/search", wrap(handlers.search));
  router.get("/profile", wrap(handlers.profile));
  router.patch("/profile", wrap(handlers.patchProfile));
  router.get("/notifications", wrap(handlers.notifications));
  return router;
}
