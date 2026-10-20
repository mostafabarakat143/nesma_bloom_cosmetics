import type { Request } from "express";
import Busboy from "busboy";

import { AppError } from "../../common/errors/app-error.js";
import { MAX_IMAGE_BYTES } from "./image-file.js";

/**
 * Read the single multipart field named `file`.
 * The size cap is one byte above the accepted maximum so a file that is
 * exactly 5 MB is kept, and anything larger is rejected.
 */
export function readImageUpload(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      !contentType.toLowerCase().includes("multipart/form-data")
    ) {
      reject(
        AppError.badRequest(
          "Upload must be multipart form data with a file field.",
        ),
      );
      return;
    }

    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: MAX_IMAGE_BYTES + 1,
          fields: 8,
          fieldSize: 1024,
        },
      });
    } catch {
      reject(
        AppError.badRequest(
          "Upload must be multipart form data with a file field.",
        ),
      );
      return;
    }

    const chunks: Buffer[] = [];
    let sawFile = false;
    let tooBig = false;
    let settled = false;

    const fail = (error: AppError): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    parser.on("file", (fieldName, stream) => {
      if (fieldName !== "file" || sawFile) {
        stream.resume();
        fail(AppError.badRequest("Send one image in the file field."));
        return;
      }
      sawFile = true;
      stream.on("limit", () => {
        tooBig = true;
        chunks.length = 0;
      });
      stream.on("data", (chunk: Buffer) => {
        if (!tooBig) {
          chunks.push(chunk);
        }
      });
      stream.on("error", () => {
        fail(AppError.badRequest("Could not read the upload."));
      });
    });

    parser.on("filesLimit", () => {
      fail(AppError.badRequest("Send one image in the file field."));
    });

    parser.on("error", () => {
      fail(AppError.badRequest("Could not read the upload."));
    });

    parser.on("close", () => {
      if (settled) {
        return;
      }
      settled = true;
      if (!sawFile) {
        reject(AppError.badRequest("Choose an image file."));
        return;
      }
      if (tooBig) {
        reject(AppError.badRequest("Image must be 5 MB or smaller."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    req.pipe(parser);
  });
}
