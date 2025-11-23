/**
 * Email Processor Service
 * Orchestrates automatic email processing with hybrid keyword/AI analysis
 */

import { query } from "../config/database";
import { analyzeEmail } from "./aiService";
import { analyzeEmailWithClaude, calculateCost } from "./claudeService";
import {
  AI_ENABLED,
  KEYWORD_CONFIDENCE_THRESHOLD,
  PROCESSING_BATCH_SIZE,
  PROCESSING_DELAY_MS,
} from "../config/aiConfig";

// ===========================
// Types
// ===========================

interface Email {
  id: string;
  gmail_account_id: string;
  subject: string;
  sender_email: string;
  body_text: string | null;
  body_html: string | null;
  received_at: Date;
  analysis_attempts: number;
}

interface AnalysisResult {
  isSubscription: boolean;
  confidence: number;
  extractedData: any;
  provider: string;
  reasoning: string;
  cost: number;
}

interface ProcessingResumeStatus {
  canResume: boolean;
  analyzedCount: number;
  toAnalyzeCount: number;
  isStale: boolean;
  staleReason?: string;
}

// ===========================
// Main Entry Point
// ===========================

/**
 * Start email processing for an account
 * Called automatically after sync completes
 * Non-blocking - runs asynchronously
 */
export async function startEmailProcessing(
  accountId: string,
  userId: string
): Promise<void> {
  try {
    console.log(`[EmailProcessing] Starting processing for account ${accountId}`);

    // Step 1: Check current processing status
    const statusCheck = await query(
      "SELECT processing_status FROM gmail_accounts WHERE id = $1",
      [accountId]
    );

    if (statusCheck.rows.length === 0) {
      console.error(`[EmailProcessing] Account ${accountId} not found`);
      return;
    }

    const currentStatus = statusCheck.rows[0].processing_status;
    if (currentStatus === "analyzing") {
      console.log(`[EmailProcessing] Account ${accountId} already processing`);
      return;
    }

    // Step 2: Check for resumable processing
    const resumeStatus = await getProcessingResumeStatus(accountId);

    if (resumeStatus.canResume) {
      if (resumeStatus.isStale) {
        console.log(
          `[EmailProcessing] Resuming stale processing for account ${accountId} - ${resumeStatus.staleReason}`
        );
      } else {
        console.log(`[EmailProcessing] Resuming previous processing for account ${accountId}`);
      }
    }

    // Step 3: Count unprocessed emails
    let toAnalyzeCount = resumeStatus.toAnalyzeCount;
    let analyzedCount = resumeStatus.analyzedCount;

    if (!resumeStatus.canResume) {
      const countResult = await query(
        "SELECT COUNT(*) as count FROM emails WHERE gmail_account_id = $1 AND processed_at IS NULL",
        [accountId]
      );

      toAnalyzeCount = parseInt(countResult.rows[0].count, 10);

      if (toAnalyzeCount === 0) {
        console.log(`[EmailProcessing] No unprocessed emails for account ${accountId}`);
        return;
      }

      // Initialize counters
      await query(
        `UPDATE gmail_accounts
         SET processing_status = 'analyzing',
             emails_to_analyze = $1,
             emails_analyzed = 0,
             subscriptions_found = 0,
             processing_started_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [toAnalyzeCount, accountId]
      );

      analyzedCount = 0;
    } else {
      // Resume: just update status to analyzing
      await query(
        "UPDATE gmail_accounts SET processing_status = 'analyzing' WHERE id = $1",
        [accountId]
      );
    }

    console.log(
      `[EmailProcessing] Processing ${toAnalyzeCount} emails for account ${accountId} (starting from ${analyzedCount})`
    );

    // Step 4: Process in batches
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalSubscriptionsFound = 0;
    let hasMore = true;

    while (hasMore) {
      const batchResult = await processEmailBatch(accountId, userId, PROCESSING_BATCH_SIZE);

      totalProcessed += batchResult.processed;
      totalSubscriptionsFound += batchResult.subscriptionsFound;
      hasMore = batchResult.hasMore;

      // Update progress
      await query(
        `UPDATE gmail_accounts
         SET emails_analyzed = emails_analyzed + $1,
             subscriptions_found = subscriptions_found + $2
         WHERE id = $3`,
        [batchResult.processed, batchResult.subscriptionsFound, accountId]
      );

      if (hasMore) {
        // Delay between batches
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));
      }
    }

    // Step 5: Mark as completed
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    await query(
      `UPDATE gmail_accounts
       SET processing_status = 'completed',
           processing_started_at = NULL
       WHERE id = $1`,
      [accountId]
    );

    console.log(
      `[EmailProcessing] Completed for account ${accountId}. Analyzed ${totalProcessed} emails, found ${totalSubscriptionsFound} subscriptions in ${duration}s`
    );
  } catch (error) {
    console.error(`[EmailProcessing] Error for account ${accountId}:`, error);

    // Mark as error but preserve progress for resume
    await query(
      "UPDATE gmail_accounts SET processing_status = 'error' WHERE id = $1",
      [accountId]
    ).catch((err) => console.error("Failed to update error status:", err));
  }
}

// ===========================
// Batch Processing
// ===========================

/**
 * Process a batch of emails
 */
async function processEmailBatch(
  accountId: string,
  userId: string,
  batchSize: number
): Promise<{ processed: number; subscriptionsFound: number; hasMore: boolean }> {
  // Step 1: Fetch batch (newest first)
  const emailsResult = await query(
    `SELECT id, gmail_account_id, subject, sender_email, body_text, body_html,
            received_at, analysis_attempts
     FROM emails
     WHERE gmail_account_id = $1 AND processed_at IS NULL
     ORDER BY received_at DESC
     LIMIT $2`,
    [accountId, batchSize]
  );

  const emails = emailsResult.rows as Email[];

  if (emails.length === 0) {
    return { processed: 0, subscriptionsFound: 0, hasMore: false };
  }

  // Step 2: Process each email
  let processed = 0;
  let subscriptionsFound = 0;

  for (const email of emails) {
    try {
      // Analyze email with hybrid approach
      const result = await analyzeEmailHybrid(email, accountId);

      // Mark as processed
      await markEmailAsProcessed(email.id, result);

      // Update account cost if there was an AI cost
      if (result.cost > 0) {
        await query(
          "UPDATE gmail_accounts SET ai_cost_total = ai_cost_total + $1 WHERE id = $2",
          [result.cost, accountId]
        );
      }

      // Create subscription if detected
      if (result.isSubscription) {
        const subscriptionId = await createSubscriptionFromEmail(email, result.extractedData, accountId);
        if (subscriptionId) {
          subscriptionsFound++;
        }
      }

      processed++;
    } catch (error) {
      console.error(`[EmailProcessing] Failed to analyze email ${email.id}:`, error);

      // Increment analysis attempts
      const attempts = email.analysis_attempts + 1;

      if (attempts >= 3) {
        // Give up after 3 attempts - mark as processed with default values
        console.log(`[EmailProcessing] Giving up on email ${email.id} after ${attempts} attempts`);
        await markEmailAsProcessed(email.id, {
          isSubscription: false,
          confidence: 0,
          extractedData: null,
          provider: "error",
          reasoning: `Failed after ${attempts} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
          cost: 0,
        });
        processed++;
      } else {
        // Increment attempts but leave unprocessed for retry
        await query(
          "UPDATE emails SET analysis_attempts = $1 WHERE id = $2",
          [attempts, email.id]
        );
      }
    }
  }

  // Step 3: Check for more emails
  const remainingResult = await query(
    "SELECT COUNT(*) as count FROM emails WHERE gmail_account_id = $1 AND processed_at IS NULL",
    [accountId]
  );

  const hasMore = parseInt(remainingResult.rows[0].count, 10) > 0;

  return { processed, subscriptionsFound, hasMore };
}

// ===========================
// Hybrid Analysis
// ===========================

/**
 * Two-stage hybrid analysis: keywords → Claude
 * Stage 1: Keyword filter (reject if confidence < 0.3)
 * Stage 2: Claude analysis (for uncertain cases)
 */
async function analyzeEmailHybrid(email: Email, accountId: string): Promise<AnalysisResult> {
  // Stage 1: Keyword Filter
  const keywordResult = await analyzeEmail({
    id: email.id,
    subject: email.subject || "",
    sender_email: email.sender_email || "",
    body_text: email.body_text || "",
    body_html: email.body_html || "",
  });

  // Decision: reject low confidence immediately
  if (keywordResult.confidence < KEYWORD_CONFIDENCE_THRESHOLD) {
    return {
      isSubscription: false,
      confidence: keywordResult.confidence,
      extractedData: {
        serviceName: keywordResult.serviceName,
        amount: keywordResult.amount,
        currency: keywordResult.currency,
        billingCycle: keywordResult.billingCycle,
        nextBillingDate: keywordResult.nextBillingDate,
      },
      provider: "keywords",
      reasoning: "Low keyword confidence - rejected without AI analysis",
      cost: 0,
    };
  }

  // Stage 2: Claude Analysis (uncertain, need AI)
  if (!AI_ENABLED) {
    // Fall back to keywords if Claude not available
    return {
      isSubscription: keywordResult.isSubscription,
      confidence: keywordResult.confidence,
      extractedData: {
        serviceName: keywordResult.serviceName,
        amount: keywordResult.amount,
        currency: keywordResult.currency,
        billingCycle: keywordResult.billingCycle,
        nextBillingDate: keywordResult.nextBillingDate,
      },
      provider: "keywords_fallback",
      reasoning: "Claude API not available - using keyword analysis",
      cost: 0,
    };
  }

  try {
    // Call Claude API
    const claudeResult = await analyzeEmailWithClaude({
      id: email.id,
      subject: email.subject || "",
      sender_email: email.sender_email || "",
      body_text: email.body_text,
      body_html: email.body_html,
      received_at: email.received_at,
    });

    // Calculate cost
    const cost = calculateCost(
      claudeResult.tokens_used.input,
      claudeResult.tokens_used.output
    );

    return {
      isSubscription: claudeResult.is_subscription,
      confidence: claudeResult.confidence,
      extractedData: {
        serviceName: claudeResult.service_name,
        amount: claudeResult.amount,
        currency: claudeResult.currency,
        billingCycle: claudeResult.billing_cycle,
        nextBillingDate: claudeResult.next_billing_date,
      },
      provider: "claude",
      reasoning: claudeResult.reasoning,
      cost,
    };
  } catch (error) {
    console.error(`[EmailProcessing] Claude API failed for email ${email.id}:`, error);

    // Fall back to keyword result
    return {
      isSubscription: keywordResult.isSubscription,
      confidence: keywordResult.confidence,
      extractedData: {
        serviceName: keywordResult.serviceName,
        amount: keywordResult.amount,
        currency: keywordResult.currency,
        billingCycle: keywordResult.billingCycle,
        nextBillingDate: keywordResult.nextBillingDate,
      },
      provider: "keywords_fallback",
      reasoning: `Claude API failed: ${error instanceof Error ? error.message : "Unknown error"}. Using keyword analysis.`,
      cost: 0,
    };
  }
}

// ===========================
// Database Operations
// ===========================

/**
 * Mark email as processed with analysis results
 */
async function markEmailAsProcessed(emailId: string, result: AnalysisResult): Promise<void> {
  await query(
    `UPDATE emails
     SET processed_at = CURRENT_TIMESTAMP,
         is_subscription = $1,
         subscription_confidence = $2,
         extracted_data = $3,
         ai_provider = $4,
         ai_reasoning = $5
     WHERE id = $6`,
    [
      result.isSubscription,
      result.confidence,
      JSON.stringify(result.extractedData),
      result.provider,
      result.reasoning,
      emailId,
    ]
  );
}

/**
 * Create subscription record from email analysis
 * Returns subscription ID if created, null if duplicate
 */
async function createSubscriptionFromEmail(
  email: Email,
  extractedData: any,
  accountId: string
): Promise<string | null> {
  // Get user_id for this account
  const accountResult = await query(
    "SELECT user_id FROM gmail_accounts WHERE id = $1",
    [accountId]
  );

  if (accountResult.rows.length === 0) {
    console.error(`[EmailProcessing] Account ${accountId} not found`);
    return null;
  }

  const userId = accountResult.rows[0].user_id;

  // Only create if we have minimum required data
  if (!extractedData.serviceName || !extractedData.amount) {
    return null;
  }

  try {
    // Insert subscription with conflict handling
    const result = await query(
      `INSERT INTO subscriptions (
        user_id,
        email_id,
        service_name,
        amount,
        currency,
        billing_cycle,
        next_billing_date,
        status,
        confidence_score,
        user_verified,
        first_detected
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, false, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, service_name, amount) DO NOTHING
      RETURNING id`,
      [
        userId,
        email.id,
        extractedData.serviceName,
        extractedData.amount,
        extractedData.currency || "USD",
        extractedData.billingCycle || "monthly",
        extractedData.nextBillingDate || null,
        0.9, // High confidence score for Claude detections
      ]
    );

    if (result.rows.length > 0) {
      console.log(
        `[EmailProcessing] Created subscription: ${extractedData.serviceName} ($${extractedData.amount})`
      );
      return result.rows[0].id;
    } else {
      console.log(
        `[EmailProcessing] Subscription already exists: ${extractedData.serviceName} ($${extractedData.amount})`
      );
      return null;
    }
  } catch (error) {
    console.error("[EmailProcessing] Failed to create subscription:", error);
    return null;
  }
}

// ===========================
// Resume Status
// ===========================

/**
 * Get processing resume status for an account
 * Detects stale processing sessions (>30 minutes)
 */
export async function getProcessingResumeStatus(accountId: string): Promise<ProcessingResumeStatus> {
  const result = await query(
    `SELECT processing_status, emails_analyzed, emails_to_analyze, processing_started_at
     FROM gmail_accounts
     WHERE id = $1`,
    [accountId]
  );

  if (result.rows.length === 0) {
    return {
      canResume: false,
      analyzedCount: 0,
      toAnalyzeCount: 0,
      isStale: false,
    };
  }

  const account = result.rows[0];
  const status = account.processing_status;
  const analyzedCount = account.emails_analyzed || 0;
  const toAnalyzeCount = account.emails_to_analyze || 0;
  const startedAt = account.processing_started_at;

  // Check if stale (>30 minutes)
  let isStale = false;
  let staleReason: string | undefined;

  if (startedAt && status === "analyzing") {
    const timeSinceStart = Date.now() - new Date(startedAt).getTime();
    const minutesSinceStart = Math.floor(timeSinceStart / 60000);

    if (minutesSinceStart > 30) {
      isStale = true;
      staleReason = `Processing started ${minutesSinceStart} minutes ago`;
    }
  }

  // Can resume if analyzing or error, and there are emails left
  const canResume =
    (status === "analyzing" || status === "error") && analyzedCount < toAnalyzeCount;

  return {
    canResume,
    analyzedCount,
    toAnalyzeCount,
    isStale,
    staleReason,
  };
}
