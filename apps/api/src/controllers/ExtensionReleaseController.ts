import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { findMonorepoRoot } from "@sell-similar/config";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import type { Auth } from "../auth.js";

/**
 * Serves the self-hosted extension build.
 *
 * The extension is distributed outside the Chrome Web Store, so the zip that CI
 * produces on each deploy is served from here behind a session check. The URL
 * is stable; the file it returns is whatever the last deploy built.
 */

/** Where the deploy drops the packaged extension. */
function releaseDir(): string {
  const configured = process.env.EXTENSION_RELEASE_DIR?.trim();
  if (configured) {
    return resolve(configured);
  }
  // Default to WXT's own output directory, which works in dev and on the VPS.
  return join(findMonorepoRoot(), "apps", "extension", ".output");
}

export type ExtensionRelease = {
  version: string;
  filename: string;
  path: string;
  sizeBytes: number;
  builtAt: string;
};

/** Newest *.zip in the release directory, or null if none is built yet. */
async function findLatestRelease(): Promise<ExtensionRelease | null> {
  const dir = releaseDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  const zips = entries.filter((name) => name.endsWith(".zip") && !name.includes("sources"));
  if (zips.length === 0) {
    return null;
  }

  let newest: ExtensionRelease | null = null;
  for (const name of zips) {
    const full = join(dir, name);
    try {
      const info = await stat(full);
      if (!info.isFile()) {
        continue;
      }
      if (!newest || info.mtimeMs > Date.parse(newest.builtAt)) {
        newest = {
          // wxt names the file <name>-<version>-chrome.zip
          version: /-(\d+\.\d+\.\d+)-/.exec(name)?.[1] ?? "unknown",
          filename: name,
          path: full,
          sizeBytes: info.size,
          builtAt: new Date(info.mtimeMs).toISOString(),
        };
      }
    } catch {
      // unreadable entry; skip it
    }
  }
  return newest;
}

/** sha256 of the release, cached per file+mtime so it is hashed once per build. */
const hashCache = new Map<string, string>();

async function releaseHash(release: ExtensionRelease): Promise<string> {
  const key = `${release.path}:${release.builtAt}:${release.sizeBytes}`;
  const cached = hashCache.get(key);
  if (cached) {
    return cached;
  }
  const digest = await new Promise<string>((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(release.path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
  hashCache.clear();
  hashCache.set(key, digest);
  return digest;
}

async function requireUser(auth: Auth, req: Request, res: Response) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user) {
    res.status(401).json({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in to download the extension" },
    });
    return null;
  }
  if ("banned" in session.user && session.user.banned) {
    res.status(403).json({
      ok: false,
      error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled" },
    });
    return null;
  }
  return session.user;
}

export function createExtensionReleaseHandlers(auth: Auth) {
  return {
    /** Metadata for the dashboard: version, size, build time, checksum. */
    releaseInfo: async function releaseInfo(req: Request, res: Response) {
      if (!(await requireUser(auth, req, res))) {
        return;
      }

      const release = await findLatestRelease();
      if (!release) {
        return res.status(503).json({
          ok: false,
          error: {
            code: "RELEASE_UNAVAILABLE",
            message: "No extension build is available yet. Try again after the next deploy.",
          },
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          version: release.version,
          filename: release.filename,
          sizeBytes: release.sizeBytes,
          builtAt: release.builtAt,
          sha256: await releaseHash(release),
        },
      });
    },

    /** Streams the zip. Same stable URL every time; newest build every time. */
    download: async function download(req: Request, res: Response) {
      if (!(await requireUser(auth, req, res))) {
        return;
      }

      const release = await findLatestRelease();
      if (!release) {
        return res.status(503).json({
          ok: false,
          error: {
            code: "RELEASE_UNAVAILABLE",
            message: "No extension build is available yet. Try again after the next deploy.",
          },
        });
      }

      // A predictable download name, so re-downloads overwrite rather than
      // piling up as "(1)", "(2)" in the browser's downloads folder.
      const downloadName = `sell-similar-extension-${release.version}.zip`;
      res.setHeader("content-type", "application/zip");
      res.setHeader("content-length", String(release.sizeBytes));
      res.setHeader("content-disposition", `attachment; filename="${basename(downloadName)}"`);
      // The file is replaced in place on every deploy, so it must never be cached.
      res.setHeader("cache-control", "no-store");

      const stream = createReadStream(release.path);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: { code: "RELEASE_READ_FAILED", message: "Could not read the extension build" },
          });
          return;
        }
        res.destroy();
      });
      stream.pipe(res);
      return undefined;
    },
  };
}
