import { Router, Response, NextFunction } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { syncGmailAccount, getUnprocessedEmails } from "../services/gmailService";
import { startEmailProcessing } from "../services/emailProcessor";
import { getGmailAccountById } from "../services/oauthService";

const router = Router();

router.use(authenticate);

// Sync Gmail account
router.post(
  "/accounts/:id/sync",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Start sync in background
      syncGmailAccount(id, req.userId!).catch((error) => {
        console.error("Sync error:", error);
      });

      res.json({
        status: "success",
        message: "Sync started",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Manual email processing trigger
router.post(
  "/accounts/:id/process",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: accountId } = req.params;
      const userId = req.userId!;

      // Verify account belongs to user
      const account = await getGmailAccountById(accountId, userId);

      // Check if processing already active
      if (account.processing_status === "analyzing") {
        return res.status(400).json({
          status: "error",
          error: "Processing already in progress",
        });
      }

      // Start processing asynchronously
      startEmailProcessing(accountId, userId).catch((error) => {
        console.error(`[EmailProcessing] Failed to start:`, error);
      });

      res.json({
        status: "success",
        message: "Email processing started",
        data: { processing_status: "analyzing" },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get unprocessed emails
router.get(
  "/accounts/:id/unprocessed",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const emails = await getUnprocessedEmails(id, limit);

      res.json({
        status: "success",
        data: { emails },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
