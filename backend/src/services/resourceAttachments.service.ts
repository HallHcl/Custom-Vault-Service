import path from "path";
import { pool } from "../db/pool";
import { withTransaction } from "../db/withTransaction";
import { ApiError } from "../middleware/errorHandler";
import { logActivity } from "../middleware/activityLogger";
import { AuthenticatedUser, ResourceAttachment, ResourceAttachmentWithUploader } from "../types";
import { UploadAttachmentBodyInput } from "../validators/resources.validator";

export async function createAttachment(
  resourceId: string,
  file: Express.Multer.File,
  input: UploadAttachmentBodyInput,
  actingPeopleId: string
): Promise<ResourceAttachmentWithUploader> {
  let targetVersionId = input.created_in_version_id || null;

  if (targetVersionId) {
    const vCheck = await pool.query(
      `SELECT id FROM resource_versions WHERE id = $1 AND resource_id = $2`,
      [targetVersionId, resourceId]
    );
    if (vCheck.rows.length === 0) {
      throw new ApiError(
        400,
        "Invalid created_in_version_id: version not found for this resource",
        "VALIDATION_ERROR",
        { fieldErrors: { created_in_version_id: ["Version not found for this resource"] } }
      );
    }
  } else {
    const rCheck = await pool.query<{ current_version_id: string | null }>(
      `SELECT current_version_id FROM resources WHERE id = $1`,
      [resourceId]
    );
    targetVersionId = rCheck.rows[0]?.current_version_id || null;
  }

  const relativeFilePath = path.join("resources", resourceId, file.filename).replace(/\\/g, "/");

  return await withTransaction(async (tx) => {
    const insertResult = await tx.query<ResourceAttachment>(
      `INSERT INTO resource_attachments (
         resource_id, created_in_version_id, file_name, file_path,
         mime_type, size_bytes, caption, uploaded_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        resourceId,
        targetVersionId,
        file.originalname,
        relativeFilePath,
        file.mimetype,
        file.size,
        input.caption ? input.caption.trim() : null,
        actingPeopleId,
      ]
    );

    const rawAttachment = insertResult.rows[0];

    const personResult = await tx.query<{ id: string; name: string }>(
      `SELECT id, name FROM people WHERE id = $1`,
      [actingPeopleId]
    );
    const uploader = personResult.rows[0] || { id: actingPeopleId, name: "Unknown" };

    const attachment: ResourceAttachmentWithUploader = {
      ...rawAttachment,
      size_bytes: Number(rawAttachment.size_bytes),
      uploader: {
        id: uploader.id,
        name: uploader.name,
      },
    };

    await logActivity(
      "resource_attachment",
      attachment.id,
      "create",
      actingPeopleId,
      null,
      attachment,
      tx
    );

    return attachment;
  });
}

export async function listAttachments(
  resourceId: string
): Promise<ResourceAttachmentWithUploader[]> {
  const result = await pool.query(
    `SELECT ra.*,
            p.id AS uploader_id, p.name AS uploader_name
     FROM resource_attachments ra
     JOIN people p ON p.id = ra.uploaded_by
     WHERE ra.resource_id = $1 AND ra.deleted_at IS NULL
     ORDER BY ra.created_at ASC`,
    [resourceId]
  );

  return result.rows.map((row) => {
    const { uploader_id, uploader_name, ...ra } = row;
    return {
      ...ra,
      size_bytes: Number(ra.size_bytes),
      uploader: {
        id: uploader_id,
        name: uploader_name,
      },
    };
  });
}

export async function getAttachmentRecord(
  resourceId: string,
  attachmentId: string
): Promise<ResourceAttachment> {
  const result = await pool.query<ResourceAttachment>(
    `SELECT * FROM resource_attachments
     WHERE id = $1 AND resource_id = $2 AND deleted_at IS NULL`,
    [attachmentId, resourceId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return {
    ...row,
    size_bytes: Number(row.size_bytes),
  };
}

export async function softDeleteAttachment(
  resourceId: string,
  attachmentId: string,
  user: AuthenticatedUser,
  actingPeopleId: string
): Promise<ResourceAttachment> {
  const existingResult = await pool.query<ResourceAttachment>(
    `SELECT * FROM resource_attachments
     WHERE id = $1 AND resource_id = $2 AND deleted_at IS NULL`,
    [attachmentId, resourceId]
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    throw new ApiError(404, "Attachment not found");
  }

  const isAdmin = user.roles.includes("admin");
  const isUploader = Boolean(user.peopleId && existing.uploaded_by === user.peopleId);

  if (!isAdmin && !isUploader) {
    throw new ApiError(
      403,
      "Only administrators or the original uploader can delete this attachment",
      "FORBIDDEN"
    );
  }

  return await withTransaction(async (tx) => {
    const updateResult = await tx.query<ResourceAttachment>(
      `UPDATE resource_attachments
       SET deleted_at = now()
       WHERE id = $1
       RETURNING *`,
      [attachmentId]
    );
    const deleted = {
      ...updateResult.rows[0],
      size_bytes: Number(updateResult.rows[0].size_bytes),
    };

    await logActivity(
      "resource_attachment",
      attachmentId,
      "delete",
      actingPeopleId,
      { ...existing, size_bytes: Number(existing.size_bytes) },
      deleted,
      tx
    );

    return deleted;
  });
}
