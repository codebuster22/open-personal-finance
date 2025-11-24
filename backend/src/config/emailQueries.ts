// Gmail query configuration for subscription email filtering

/**
 * High-confidence subject keywords that strongly indicate subscription/billing emails
 * These are specific enough to avoid false positives
 */
export const SUBSCRIPTION_SUBJECT_KEYWORDS = [
  "subscription",
  "billing",
  "invoice",
  "receipt",
  "payment received",
  "payment confirmation",
  "payment successful",
  "renew",
  "renewal",
  "auto-pay",
  "autopay",
  "membership",
  "premium",
  "plan upgraded",
  "plan downgraded",
  "recurring charge",
  "monthly charge",
  "annual charge",
  "yearly charge",
  "charged",
  "statement",
  "payment method",
  "card ending",
  "trial ending",
  "trial ends",
  "cancel subscription",
];

/**
 * Specific billing sender patterns (removed overly generic ones like "noreply")
 * These are specifically associated with billing/payment systems
 */
export const BILLING_SENDER_PATTERNS = [
  "billing",
  "subscriptions",
  "payments",
  "invoices",
  "receipts",
  "finance",
  "accounts-payable",
  "membership",
];

/**
 * Format a date as YYYY/MM/DD for Gmail query syntax
 */
function formatGmailDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Build Gmail API query string for email sync
 *
 * Strategy: Focus on subscription-specific keywords in subject and billing-specific senders
 * This avoids false positives like LinkedIn messages, Prime Video recommendations, etc.
 *
 * @param syncType - Type of sync: "initial" (first time) or "incremental" (subsequent)
 * @param lastSyncDate - Date of last sync (for incremental syncs)
 * @param monthsBack - How many months to look back for initial sync (default: 12)
 * @returns Gmail API query string
 */
export function buildGmailSyncQuery(
  syncType: "initial" | "incremental",
  lastSyncDate: Date | null,
  monthsBack: number = 12
): string {
  // Build subject filter: (subject:"keyword1" OR subject:"keyword2" ...)
  // Using quotes for multi-word phrases
  const subjectFilters = SUBSCRIPTION_SUBJECT_KEYWORDS.map((keyword) => {
    // Quote multi-word keywords
    const quoted = keyword.includes(" ") ? `"${keyword}"` : keyword;
    return `subject:${quoted}`;
  }).join(" OR ");

  // Build sender filter: (from:pattern1 OR from:pattern2 ...)
  const senderFilters = BILLING_SENDER_PATTERNS.map(
    (pattern) => `from:${pattern}`
  ).join(" OR ");

  // Combine content filters with OR
  // Only using subject keywords and billing senders - removed generic service providers
  const contentFilter = `(${subjectFilters} OR ${senderFilters})`;

  // Build date filter based on sync type
  let dateFilter: string;
  if (syncType === "initial") {
    // Calculate date N months back
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    dateFilter = `after:${formatGmailDate(cutoffDate)}`;
  } else {
    // Use last sync date for incremental
    if (!lastSyncDate) {
      throw new Error("lastSyncDate is required for incremental sync");
    }
    dateFilter = `after:${formatGmailDate(lastSyncDate)}`;
  }

  // Build exclusion filter
  const exclusions = "-in:spam -in:trash";

  // Combine all filters
  const finalQuery = `${contentFilter} ${dateFilter} ${exclusions}`;

  return finalQuery;
}

/**
 * Calculate SHA-256 hash of query string for resume validation
 *
 * @param query - Gmail query string
 * @returns Hex-encoded hash (first 16 characters)
 */
export async function calculateQueryHash(query: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Return first 16 characters (sufficient for collision avoidance)
  return hashHex.substring(0, 16);
}

/**
 * Simple synchronous hash for quick comparisons (fallback)
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
