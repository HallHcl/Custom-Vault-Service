import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { ApiError } from "./errorHandler";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function getBaseUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, "../../uploads");
}

export function getAttachmentDiskPath(relativePath: string): string {
  const cleanPath = relativePath.replace(/^uploads[\\/]/, "");
  return path.resolve(getBaseUploadsDir(), cleanPath);
}

export async function validateResourceExists(req: Request, _res: Response, next: NextFunction) {
  try {
    const resourceId = typeof req.params.id === "string" ? req.params.id : "";
    if (!resourceId || !UUID_REGEX.test(resourceId)) {
      return next(new ApiError(404, "Resource not found"));
    }

    const result = await pool.query(
      `SELECT id FROM resources WHERE id = $1 AND deleted_at IS NULL`,
      [resourceId]
    );

    if (result.rows.length === 0) {
      return next(new ApiError(404, "Resource not found"));
    }

    next();
  } catch (err) {
    next(err);
  }
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const resourceId = typeof req.params.id === "string" ? req.params.id : "";
    const destDir = path.join(getBaseUploadsDir(), "resources", resourceId);
    try {
      fs.mkdirSync(destDir, { recursive: true });
      cb(null, destDir);
    } catch (err) {
      cb(err as Error, destDir);
    }
  },
  filename: (_req, file, cb) => {
    const fileId = crypto.randomUUID();
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${fileId}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          `Invalid file type: ${file.mimetype}. Allowed types: image/png, image/jpeg, image/webp, image/svg+xml`,
          "VALIDATION_ERROR",
          { fieldErrors: { file: [`Unsupported file type: ${file.mimetype}`] } }
        )
      );
    }
  },
});

export function handleAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, "File size exceeds 10MB limit", "VALIDATION_ERROR", {
              fieldErrors: { file: ["File size exceeds 10MB limit"] },
            })
          );
        }
        return next(
          new ApiError(400, err.message, "VALIDATION_ERROR", {
            fieldErrors: { file: [err.message] },
          })
        );
      }
      return next(err);
    }
    next();
  });
}
