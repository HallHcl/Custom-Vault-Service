import fs from "fs";
import { Request, Response } from "express";
import { ApiError } from "../middleware/errorHandler";
import { paramId, requireChangedBy } from "../utils/requestContext";
import { getResourceById } from "../services/resources.service";
import { uploadAttachmentBodySchema } from "../validators/resources.validator";
import {
  createAttachment,
  getAttachmentRecord,
  listAttachments,
  softDeleteAttachment,
} from "../services/resourceAttachments.service";
import { getAttachmentDiskPath } from "../middleware/resourceAttachmentUpload";

export async function uploadAttachmentHandler(req: Request, res: Response) {
  if (!req.file) {
    throw new ApiError(400, "File is required", "VALIDATION_ERROR", {
      fieldErrors: { file: ["File is required"] },
    });
  }

  const parseResult = uploadAttachmentBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore unlink error
      }
    }
    throw new ApiError(400, "Validation failed", "VALIDATION_ERROR", parseResult.error.flatten());
  }

  const resourceId = paramId(req, "id");
  const actingPeopleId = requireChangedBy(req);

  try {
    const attachment = await createAttachment(
      resourceId,
      req.file,
      parseResult.data,
      actingPeopleId
    );
    res.status(201).json(attachment);
  } catch (err) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore unlink error
      }
    }
    throw err;
  }
}

export async function listAttachmentsHandler(req: Request, res: Response) {
  const resourceId = paramId(req, "id");
  await getResourceById(resourceId);

  const attachments = await listAttachments(resourceId);
  res.json(attachments);
}

export async function streamAttachmentContentHandler(req: Request, res: Response) {
  const resourceId = paramId(req, "id");
  const attachmentId = paramId(req, "attachmentId");

  await getResourceById(resourceId);
  const attachment = await getAttachmentRecord(resourceId, attachmentId);

  const diskPath = getAttachmentDiskPath(attachment.file_path);
  if (!fs.existsSync(diskPath)) {
    throw new ApiError(404, "Attachment file not found on disk");
  }

  res.setHeader("Content-Type", attachment.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${attachment.file_name}"`);
  res.setHeader("Content-Length", attachment.size_bytes);

  const stream = fs.createReadStream(diskPath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: { message: "Error streaming attachment file" } });
    }
  });
  stream.pipe(res);
}

export async function deleteAttachmentHandler(req: Request, res: Response) {
  const resourceId = paramId(req, "id");
  const attachmentId = paramId(req, "attachmentId");
  const actingPeopleId = requireChangedBy(req);

  await getResourceById(resourceId);
  await softDeleteAttachment(resourceId, attachmentId, req.user!, actingPeopleId);

  res.json({ message: "Attachment deleted successfully" });
}
