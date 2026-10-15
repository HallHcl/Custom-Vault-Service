import { Router } from "express";
import { auth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  changePassword,
  login,
  logout,
  me,
  updateLinkedPerson,
  updateMe,
} from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.get("/me", auth, me);
router.patch("/me", auth, updateMe);
router.put("/me/person", auth, requireRole("admin"), updateLinkedPerson);
router.post("/logout", auth, logout);
router.post("/change-password", auth, changePassword);

export default router;

