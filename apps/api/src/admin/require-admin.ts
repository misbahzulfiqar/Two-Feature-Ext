import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AccessAuth } from "../access.js";

export function requireAdmin(auth: AccessAuth) {
  return async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const user = session?.user as { id?: string; name?: string; email?: string; role?: string } | undefined;
    const role = String(user?.role ?? "");
    if (!user?.id || !user.email || role !== "admin") {
      res.status(401).json({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Admin sign-in required." },
      });
      return;
    }
    req.accessUser = {
      id: user.id,
      name: user.name?.trim() || user.email,
      email: user.email,
      role,
    };
    next();
  };
}
