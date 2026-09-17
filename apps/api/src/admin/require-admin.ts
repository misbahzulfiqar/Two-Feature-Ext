import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../auth.js";

export type AdminActor = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

declare global {
  namespace Express {
    interface Request {
      adminActor?: AdminActor;
    }
  }
}

export function createRequireAdmin(auth: Auth) {
  return async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      res.status(401).json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in required" },
      });
      return;
    }
    const banned = "banned" in session.user ? Boolean(session.user.banned) : false;
    if (banned) {
      res.status(403).json({
        ok: false,
        error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled" },
      });
      return;
    }
    const role = "role" in session.user ? String(session.user.role ?? "user") : "user";
    if (role !== "admin") {
      res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Administrator access required" },
      });
      return;
    }
    req.adminActor = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? "",
      role: "admin",
    };
    next();
  };
}

export function createRequireActiveUser(auth: Auth) {
  return async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      res.status(401).json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Sign in required" },
      });
      return;
    }
    const banned = "banned" in session.user ? Boolean(session.user.banned) : false;
    if (banned) {
      res.status(403).json({
        ok: false,
        error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled" },
      });
      return;
    }
    next();
  };
}
