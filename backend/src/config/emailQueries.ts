// Gmail query configuration for subscription email filtering

/**
 * Subject keywords that commonly appear in subscription/billing emails
 */
export const SUBSCRIPTION_SUBJECT_KEYWORDS = [
  "subscription",
  "billing",
  "invoice",
  "receipt",
  "payment",
  "renew",
  "renewal",
  "auto-pay",
  "autopay",
  "membership",
  "premium",
  "upgrade",
  "plan",
  "recurring",
  "charged",
  "statement",
];

/**
 * Sender patterns commonly used by billing systems
 */
export const BILLING_SENDER_PATTERNS = [
  "noreply",
  "no-reply",
  "billing",
  "subscriptions",
  "payments",
  "invoices",
  "receipts",
  "support",
  "accounts",
  "finance",
];

/**
 * Popular subscription services to target
 */
export const POPULAR_SUBSCRIPTION_SERVICES = [
  "netflix",
  "spotify",
  "amazon",
  "prime",
  "disney",
  "hulu",
  "apple",
  "google",
  "microsoft",
  "adobe",
  "github",
  "slack",
  "dropbox",
  "notion",
  "figma",
  "zoom",
  "linkedin",
  "youtube",
  "audible",
  "kindle",
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
  // Build subject filter: (subject:keyword1 OR subject:keyword2 ...)
  const subjectFilters = SUBSCRIPTION_SUBJECT_KEYWORDS.map(
    (keyword) => `subject:${keyword}`
  ).join(" OR ");

  // Build sender filter: (from:pattern1 OR from:pattern2 ...)
  const senderFilters = BILLING_SENDER_PATTERNS.map(
    (pattern) => `from:${pattern}`
  ).join(" OR ");

  // Build service filter: (from:service1 OR from:service2 ...)
  const serviceFilters = POPULAR_SUBSCRIPTION_SERVICES.map(
    (service) => `from:${service}`
  ).join(" OR ");

  // Combine content filters with OR
  const contentFilter = `(${subjectFilters} OR ${senderFilters} OR ${serviceFilters})`;

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
