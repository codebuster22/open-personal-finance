import { Router, Response, NextFunction } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  getSubscriptionStats,
  getCategories,
  createCategory,
} from "../services/subscriptionService";

const router = Router();

router.use(authenticate);

// Get all subscriptions
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await getSubscriptions(req.userId!);

    res.json({
      status: "success",
      data: { subscriptions },
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription stats
router.get(
  "/stats",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await getSubscriptionStats(req.userId!);

      res.json({
        status: "success",
        data: { stats },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get categories
router.get(
  "/categories",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await getCategories(req.userId!);

      res.json({
        status: "success",
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create category
router.post(
  "/categories",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, color, icon } = req.body;

      if (!name) {
        return res.status(400).json({
          status: "error",
          message: "Category name is required",
        });
      }

      const category = await createCategory(
        req.userId!,
        name,
        color || "#10B981",
        icon || "folder"
      );

      res.status(201).json({
        status: "success",
        data: { category },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create subscription
router.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      emailId,
      serviceName,
      amount,
      currency,
      billingCycle,
      nextBillingDate,
      confidenceScore,
      categoryId,
      notes,
    } = req.body;

    if (!serviceName || amount === undefined || !billingCycle) {
      return res.status(400).json({
        status: "error",
        message: "serviceName, amount, and billingCycle are required",
      });
    }

    const subscription = await createSubscription(req.userId!, {
      emailId,
      serviceName,
      amount,
      currency,
      billingCycle,
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : undefined,
      confidenceScore,
      categoryId,
      notes,
    });

    res.status(201).json({
      status: "success",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
});

// Get single subscription
router.get(
  "/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const subscription = await getSubscriptionById(req.params.id, req.userId!);

      res.json({
        status: "success",
        data: { subscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update subscription
router.put(
  "/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const subscription = await updateSubscription(
        req.params.id,
        req.userId!,
        req.body
      );

      res.json({
        status: "success",
        data: { subscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete subscription
router.delete(
  "/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await deleteSubscription(req.params.id, req.userId!);

      res.json({
        status: "success",
        message: "Subscription deleted",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
