import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  changePassword,
  login,
  logout,
  me,
  updateMe,
} from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.get("/me", auth, me);
router.patch("/me", auth, updateMe);
router.post("/logout", auth, logout);
router.post("/change-password", auth, changePassword);

export default router;
