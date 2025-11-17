import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";

export interface Subscription {
  id: string;
  user_id: string;
  email_id: string | null;
  service_name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: Date | null;
  status: string;
  confidence_score: number;
  user_verified: boolean;
  first_detected: Date;
  last_updated: Date;
  category_id: string | null;
  notes: string | null;
}

export const createSubscription = async (
  userId: string,
  data: {
    emailId?: string;
    serviceName: string;
    amount: number;
    currency?: string;
    billingCycle: string;
    nextBillingDate?: Date;
    confidenceScore?: number;
    categoryId?: string;
    notes?: string;
  }
): Promise<Subscription> => {
  const result = await query(
    `INSERT INTO subscriptions (
       user_id, email_id, service_name, amount, currency, billing_cycle,
       next_billing_date, confidence_score, category_id, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      data.emailId || null,
      data.serviceName,
      data.amount,
      data.currency || "USD",
      data.billingCycle,
      data.nextBillingDate || null,
      data.confidenceScore || 0,
      data.categoryId || null,
      data.notes || null,
    ]
  );

  return result.rows[0];
};

export const getSubscriptions = async (userId: string): Promise<Subscription[]> => {
  const result = await query(
    `SELECT s.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM subscriptions s
     LEFT JOIN categories c ON s.category_id = c.id
     WHERE s.user_id = $1
     ORDER BY s.last_updated DESC`,
    [userId]
  );

  return result.rows;
};

export const getSubscriptionById = async (
  subscriptionId: string,
  userId: string
): Promise<Subscription> => {
  const result = await query(
    `SELECT s.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM subscriptions s
     LEFT JOIN categories c ON s.category_id = c.id
     WHERE s.id = $1 AND s.user_id = $2`,
    [subscriptionId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("Subscription not found", 404);
  }

  return result.rows[0];
};

export const updateSubscription = async (
  subscriptionId: string,
  userId: string,
  data: Partial<{
    serviceName: string;
    amount: number;
    currency: string;
    billingCycle: string;
    nextBillingDate: Date;
    status: string;
    userVerified: boolean;
    categoryId: string;
    notes: string;
  }>
): Promise<Subscription> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.serviceName !== undefined) {
    fields.push(`service_name = $${paramCount++}`);
    values.push(data.serviceName);
  }
  if (data.amount !== undefined) {
    fields.push(`amount = $${paramCount++}`);
    values.push(data.amount);
  }
  if (data.currency !== undefined) {
    fields.push(`currency = $${paramCount++}`);
    values.push(data.currency);
  }
  if (data.billingCycle !== undefined) {
    fields.push(`billing_cycle = $${paramCount++}`);
    values.push(data.billingCycle);
  }
  if (data.nextBillingDate !== undefined) {
    fields.push(`next_billing_date = $${paramCount++}`);
    values.push(data.nextBillingDate);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(data.status);
  }
  if (data.userVerified !== undefined) {
    fields.push(`user_verified = $${paramCount++}`);
    values.push(data.userVerified);
  }
  if (data.categoryId !== undefined) {
    fields.push(`category_id = $${paramCount++}`);
    values.push(data.categoryId);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${paramCount++}`);
    values.push(data.notes);
  }

  if (fields.length === 0) {
    throw new AppError("No fields to update", 400);
  }

  fields.push("last_updated = CURRENT_TIMESTAMP");

  const result = await query(
    `UPDATE subscriptions
     SET ${fields.join(", ")}
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING *`,
    [...values, subscriptionId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("Subscription not found", 404);
  }

  return result.rows[0];
};

export const deleteSubscription = async (
  subscriptionId: string,
  userId: string
): Promise<void> => {
  const result = await query(
    `DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id`,
    [subscriptionId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("Subscription not found", 404);
  }
};

export const getSubscriptionStats = async (
  userId: string
): Promise<{
  totalMonthly: number;
  totalYearly: number;
  activeCount: number;
  categoryBreakdown: Array<{ category: string; amount: number; count: number }>;
}> => {
  const result = await query(
    `SELECT
       SUM(CASE
         WHEN billing_cycle = 'monthly' THEN amount
         WHEN billing_cycle = 'yearly' THEN amount / 12
         WHEN billing_cycle = 'weekly' THEN amount * 4.33
         ELSE 0
       END) as total_monthly,
       SUM(CASE
         WHEN billing_cycle = 'monthly' THEN amount * 12
         WHEN billing_cycle = 'yearly' THEN amount
         WHEN billing_cycle = 'weekly' THEN amount * 52
         ELSE 0
       END) as total_yearly,
       COUNT(*) FILTER (WHERE status = 'active') as active_count
     FROM subscriptions
     WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );

  const categoryResult = await query(
    `SELECT
       COALESCE(c.name, 'Uncategorized') as category,
       SUM(s.amount) as amount,
       COUNT(*) as count
     FROM subscriptions s
     LEFT JOIN categories c ON s.category_id = c.id
     WHERE s.user_id = $1 AND s.status = 'active'
     GROUP BY c.name
     ORDER BY amount DESC`,
    [userId]
  );

  return {
    totalMonthly: parseFloat(result.rows[0].total_monthly) || 0,
    totalYearly: parseFloat(result.rows[0].total_yearly) || 0,
    activeCount: parseInt(result.rows[0].active_count) || 0,
    categoryBreakdown: categoryResult.rows.map((row) => ({
      category: row.category,
      amount: parseFloat(row.amount),
      count: parseInt(row.count),
    })),
  };
};

export const getCategories = async (userId: string): Promise<any[]> => {
  const result = await query(
    `SELECT id, name, color, icon, is_system
     FROM categories
     WHERE user_id = $1
     ORDER BY is_system DESC, name ASC`,
    [userId]
  );

  return result.rows;
};

export const createCategory = async (
  userId: string,
  name: string,
  color: string,
  icon: string
): Promise<any> => {
  const result = await query(
    `INSERT INTO categories (user_id, name, color, icon, is_system)
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [userId, name, color, icon]
  );

  return result.rows[0];
};
