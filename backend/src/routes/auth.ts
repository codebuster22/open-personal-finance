import { Router, Request, Response, NextFunction } from "express";
import { registerUser, loginUser, getUserById } from "../services/authService";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Register new user
router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ status: "error", message: "Email and password are required" });
      }

      const { user, token } = await registerUser(email, password);

      res.status(201).json({
        status: "success",
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login user
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ status: "error", message: "Email and password are required" });
      }

      const { user, token } = await loginUser(email, password);

      res.json({
        status: "success",
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await getUserById(req.userId!);

      res.json({
        status: "success",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
