import { Router } from "express";
import { requireAnyRole, requireRole } from "../middleware/rbac";
import {
  create,
  createVersionHandler,
  getOne,
  getVersionHandler,
  list,
  listVersionsHandler,
  remove,
  restore,
  updateMetadataHandler,
} from "../controllers/resources.controller";
import {
  deleteAttachmentHandler,
  listAttachmentsHandler,
  streamAttachmentContentHandler,
  uploadAttachmentHandler,
} from "../controllers/resourceAttachments.controller";
import {
  handleAttachmentUpload,
  validateResourceExists,
} from "../middleware/resourceAttachmentUpload";

const router = Router();

router.get("/", list);
router.post("/", requireAnyRole(["admin", "member"]), create);
router.get("/:id", getOne);
router.patch("/:id", requireRole("admin"), updateMetadataHandler);
router.delete("/:id", requireRole("admin"), remove);
router.post("/:id/restore", requireRole("admin"), restore);

router.get("/:id/versions", listVersionsHandler);
router.get("/:id/versions/:versionId", getVersionHandler);
router.post("/:id/versions", requireAnyRole(["admin", "member"]), createVersionHandler);

router.get("/:id/attachments", listAttachmentsHandler);
router.post(
  "/:id/attachments",
  requireAnyRole(["admin", "member"]),
  validateResourceExists,
  handleAttachmentUpload,
  uploadAttachmentHandler
);
router.get("/:id/attachments/:attachmentId/content", streamAttachmentContentHandler);
router.delete("/:id/attachments/:attachmentId", deleteAttachmentHandler);

export default router;

