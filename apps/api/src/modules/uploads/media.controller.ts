import { access, constants } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import type { Env } from "../../config/env.js";
import { resolveManagedFile, type MediaScope } from "./image-storage.js";

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function asScope(value: string): MediaScope | null {
  if (value === "catalog" || value === "avatars") {
    return value;
  }
  return null;
}

export function createMediaController(env: Env) {
  return {
    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const scopeParam = req.params.scope;
        const filenameParam = req.params.filename;
        const scope =
          typeof scopeParam === "string" ? asScope(scopeParam) : null;
        const filename =
          typeof filenameParam === "string" ? filenameParam : null;

        if (!scope || !filename) {
          throw AppError.notFound("Image not found");
        }

        const fullPath = resolveManagedFile(env, scope, filename);
        if (!fullPath) {
          throw AppError.notFound("Image not found");
        }

        try {
          await access(fullPath, constants.R_OK);
        } catch {
          throw AppError.notFound("Image not found");
        }

        const ext = path.extname(filename).slice(1);
        const contentType =
          ext === "jpg" || ext === "png" || ext === "webp"
            ? CONTENT_TYPES[ext]
            : null;
        if (!contentType) {
          throw AppError.notFound("Image not found");
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader(
          "Cache-Control",
          scope === "catalog"
            ? "public, max-age=31536000, immutable"
            : "public, max-age=0, must-revalidate",
        );
        res.sendFile(fullPath, (error) => {
          if (error) {
            next(error);
          }
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
