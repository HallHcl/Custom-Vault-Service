import { Router } from "express";
import { requireAnyRole, requireRole } from "../middleware/rbac";
import {
  create,
  getOne,
  getSummary,
  list,
  remove,
  restore,
  update,
} from "../controllers/expirations.controller";

const router = Router();

router.get("/", list);
router.get("/summary", getSummary);
router.get("/:id", getOne);
router.post("/", requireAnyRole(["admin", "member"]), create);
router.patch("/:id", requireAnyRole(["admin", "member"]), update);
router.delete("/:id", requireRole("admin"), remove);
router.post("/:id/restore", requireRole("admin"), restore);

export default router;
