import { query } from "../config/database";
import {
  getGmailAccountById,
  getOAuthCredentialById,
  updateGmailAccountTokens,
  updateGmailAccountSyncStatus,
  getResumeStatus,
  clearResumeData,
} from "./oauthService";
import { decrypt } from "../config/encryption";
import { AppError } from "../middleware/errorHandler";
import { buildGmailSyncQuery, calculateQueryHash } from "../config/emailQueries";
import { startEmailProcessing } from "./emailProcessor";

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

export const refreshAccessToken = async (
  accountId: string,
  userId: string
): Promise<string> => {
  const account = await getGmailAccountById(accountId, userId);
  const credential = await getOAuthCredentialById(account.oauth_credential_id, userId);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: account.refresh_token,
      client_id: credential.client_id,
      client_secret: credential.client_secret,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new AppError("Failed to refresh access token", 401);
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await updateGmailAccountTokens(accountId, tokens.access_token, expiresAt);

  return tokens.access_token;
};

export const getAccessToken = async (
  accountId: string,
  userId: string
): Promise<string> => {
  const account = await getGmailAccountById(accountId, userId);

  // Check if token is expired or about to expire (5 minute buffer)
  const expiryBuffer = 5 * 60 * 1000;
  if (new Date(account.token_expiry).getTime() - Date.now() < expiryBuffer) {
    return refreshAccessToken(accountId, userId);
  }

  return account.access_token;
};

export const fetchEmails = async (
  accountId: string,
  userId: string,
  maxResults: number,
  pageToken: string | null,
  gmailQuery: string
): Promise<{ emails: any[]; nextPageToken?: string }> => {
  const accessToken = await getAccessToken(accountId, userId);

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", maxResults.toString());
  url.searchParams.set("q", gmailQuery);
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new AppError(`Failed to fetch emails: ${JSON.stringify(error)}`, 500);
  }

  const data = await response.json();

  return {
    emails: data.messages || [],
    nextPageToken: data.nextPageToken,
  };
};

export const fetchEmailDetails = async (
  accountId: string,
  userId: string,
  messageId: string
): Promise<GmailMessage> => {
  const accessToken = await getAccessToken(accountId, userId);

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new AppError(`Failed to fetch email details: ${JSON.stringify(error)}`, 500);
  }

  return response.json();
};

const decodeBase64 = (data: string): string => {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
};

const extractEmailBody = (message: GmailMessage): { text: string; html: string } => {
  let text = "";
  let html = "";

  const extractFromParts = (parts: any[]) => {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64(part.body.data);
      } else if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  };

  if (message.payload.parts) {
    extractFromParts(message.payload.parts);
  } else if (message.payload.body?.data) {
    text = decodeBase64(message.payload.body.data);
  }

  return { text, html };
};

const getHeader = (headers: Array<{ name: string; value: string }>, name: string): string => {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
};

export const saveEmail = async (
  gmailAccountId: string,
  message: GmailMessage
): Promise<string> => {
  const subject = getHeader(message.payload.headers, "Subject");
  const from = getHeader(message.payload.headers, "From");
  const { text, html } = extractEmailBody(message);
  const receivedAt = new Date(parseInt(message.internalDate));

  // Extract email address from "Name <email@example.com>" format
  const emailMatch = from.match(/<([^>]+)>/) || [null, from];
  const senderEmail = emailMatch[1] || from;

  const result = await query(
    `INSERT INTO emails (gmail_account_id, gmail_message_id, subject, sender_email, body_text, body_html, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (gmail_account_id, gmail_message_id) DO UPDATE SET
       subject = EXCLUDED.subject,
       sender_email = EXCLUDED.sender_email,
       body_text = EXCLUDED.body_text,
       body_html = EXCLUDED.body_html,
       received_at = EXCLUDED.received_at
     RETURNING id`,
    [gmailAccountId, message.id, subject, senderEmail, text, html, receivedAt]
  );

  return result.rows[0].id;
};

/**
 * Save sync progress atomically in a transaction
 */
const saveProgressTransaction = async (
  accountId: string,
  processedCount: number,
  pageToken: string,
  lastMessageId: string
): Promise<void> => {
  try {
    await query("BEGIN");

    await query(
      `UPDATE gmail_accounts
       SET processed_emails = $1,
           last_page_token = $2,
           last_processed_message_id = $3
       WHERE id = $4`,
      [processedCount, pageToken, lastMessageId, accountId]
    );

    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK");

    // Retry once
    try {
      await query("BEGIN");

      await query(
        `UPDATE gmail_accounts
         SET processed_emails = $1,
             last_page_token = $2,
             last_processed_message_id = $3
         WHERE id = $4`,
        [processedCount, pageToken, lastMessageId, accountId]
      );

      await query("COMMIT");
    } catch (retryError) {
      await query("ROLLBACK");
      console.error("[GmailSync] Transaction failed after retry:", retryError);
      // Don't throw - let sync continue
    }
  }
};

export const syncGmailAccount = async (
  accountId: string,
  userId: string
): Promise<{ processed: number; total: number }> => {
  const syncStartTime = Date.now();

  try {
    // Phase 0: Resume Detection and Validation
    console.log(`[GmailSync] [AccountID:${accountId}] [Start] Beginning sync process`);

    const resumeStatus = await getResumeStatus(accountId);
    const account = await getGmailAccountById(accountId, userId);

    // Determine sync type (initial vs incremental)
    const syncType = account.is_initial_sync_complete ? "incremental" : "initial";
    const lastSyncDate = account.last_sync ? new Date(account.last_sync) : null;

    // Build query based on sync type
    const gmailQuery = buildGmailSyncQuery(syncType, lastSyncDate, 12);
    const currentQueryHash = await calculateQueryHash(gmailQuery);

    console.log(
      `[GmailSync] [AccountID:${accountId}] [Query] Type: ${syncType}, Query: ${gmailQuery}`
    );

    // Validate resume compatibility
    let canResume = resumeStatus.canResume;
    let isResuming = false;
    let startingPageToken: string | null = null;
    let startingProcessedCount = 0;
    let skipCounting = false;

    if (canResume) {
      // Check if query hash matches
      if (resumeStatus.queryHash !== currentQueryHash) {
        console.log(
          `[GmailSync] [AccountID:${accountId}] [QueryMismatch] Old hash: ${resumeStatus.queryHash}, New hash: ${currentQueryHash}, starting fresh`
        );
        await clearResumeData(accountId);
        canResume = false;
      } else {
        isResuming = true;
        startingPageToken = resumeStatus.resumeToken;
        startingProcessedCount = resumeStatus.processedCount;
        skipCounting = true;

        if (resumeStatus.isStale) {
          console.log(
            `[GmailSync] [AccountID:${accountId}] [Resume] Resuming stale sync from ${startingProcessedCount} emails. ${resumeStatus.staleReason}`
          );
        } else {
          console.log(
            `[GmailSync] [AccountID:${accountId}] [Resume] Resuming from ${startingProcessedCount} emails`
          );
        }
      }
    }

    // Initialize sync if not resuming
    if (!isResuming) {
      await updateGmailAccountSyncStatus(
        accountId,
        "syncing",
        undefined,
        0,
        "",
        "",
        new Date(),
        currentQueryHash
      );
    }

    // Phase 1: Counting (conditional)
    let totalCount = 0;

    if (!skipCounting) {
      console.log(`[GmailSync] [AccountID:${accountId}] [Counting] Starting email count`);

      let countPageToken: string | null = null;
      do {
        const { emails, nextPageToken } = await fetchEmails(
          accountId,
          userId,
          500,
          countPageToken,
          gmailQuery
        );
        totalCount += emails.length;
        countPageToken = nextPageToken || null;
      } while (countPageToken);

      await updateGmailAccountSyncStatus(accountId, "syncing", totalCount, 0);
      console.log(`[GmailSync] [AccountID:${accountId}] [Counted] Total: ${totalCount} emails`);
    } else {
      totalCount = resumeStatus.totalCount;
      console.log(
        `[GmailSync] [AccountID:${accountId}] [Resume] Total already known: ${totalCount} emails`
      );
    }

    // Phase 2: Fetching with Resume Support
    let currentPageToken: string | null = startingPageToken;
    let processedCount = startingProcessedCount;
    let batchNumber = Math.floor(processedCount / 100);
    let skippedCount = 0;

    console.log(`[GmailSync] [AccountID:${accountId}] [Fetching] Starting email fetch and save`);

    do {
      const { emails, nextPageToken } = await fetchEmails(
        accountId,
        userId,
        100,
        currentPageToken,
        gmailQuery
      );

      if (!emails || emails.length === 0) {
        break;
      }

      let lastMessageIdInBatch = "";

      for (const email of emails) {
        try {
          const details = await fetchEmailDetails(accountId, userId, email.id);
          await saveEmail(accountId, details);
          lastMessageIdInBatch = email.id;
          processedCount++;
        } catch (error: any) {
          console.error(
            `[GmailSync] [AccountID:${accountId}] [Error] Failed to process email ${email.id}:`,
            error.message
          );
          skippedCount++;
          // Continue with next email - don't fail entire sync
        }
      }

      // Save progress after entire batch completes
      await saveProgressTransaction(
        accountId,
        processedCount,
        nextPageToken || "",
        lastMessageIdInBatch
      );

      // Log progress every 10 batches (every 1000 emails)
      batchNumber++;
      if (batchNumber % 10 === 0) {
        const percentage = Math.floor((processedCount / totalCount) * 100);
        const elapsedSeconds = Math.floor((Date.now() - syncStartTime) / 1000);
        console.log(
          `[GmailSync] [AccountID:${accountId}] [Progress] ${processedCount}/${totalCount} (${percentage}%) - ${batchNumber} batches, ${elapsedSeconds}s elapsed`
        );
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for completion
      if (!nextPageToken) {
        break;
      }

      currentPageToken = nextPageToken;
    } while (true);

    // Phase 3: Completion
    await clearResumeData(accountId);
    await updateGmailAccountSyncStatus(
      accountId,
      "completed",
      totalCount,
      processedCount,
      "",
      "",
      null,
      "",
      syncType === "initial" ? true : undefined,
      ""
    );

    const durationSeconds = Math.floor((Date.now() - syncStartTime) / 1000);
    console.log(
      `[GmailSync] [AccountID:${accountId}] [Complete] Processed ${processedCount} emails in ${durationSeconds}s. Skipped: ${skippedCount}`
    );

    // Trigger automatic email processing (non-blocking)
    startEmailProcessing(accountId, userId).catch((error) => {
      console.error(`[EmailProcessing] Failed to start for account ${accountId}:`, error);
    });

    return { processed: processedCount, total: totalCount };
  } catch (error: any) {
    // Phase 4: Error Handling
    console.error(`[GmailSync] [AccountID:${accountId}] [Error] ${error.message}`, error);

    // Determine error type and handling
    let errorMessage = "Unexpected error occurred. Please retry or contact support.";
    let shouldPreserveResume = true;

    if (error.message?.includes("401") || error.message?.includes("403")) {
      // Auth error
      errorMessage = "Gmail access expired. Please reconnect your account.";
      shouldPreserveResume = false;
      await clearResumeData(accountId);
    } else if (error.message?.includes("429") || error.message?.includes("quota")) {
      // Rate limit error
      errorMessage = "Gmail rate limit reached. Please retry in 1 hour.";
      shouldPreserveResume = true;
    } else if (
      error.message?.includes("fetch") ||
      error.message?.includes("network") ||
      error.message?.includes("timeout")
    ) {
      // Network error
      errorMessage = "Network error occurred. Click 'Sync Now' to retry.";
      shouldPreserveResume = true;
    }

    await updateGmailAccountSyncStatus(
      accountId,
      "error",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      errorMessage
    );

    console.log(
      `[GmailSync] [AccountID:${accountId}] [Error] ${error.message}, Resume preserved: ${shouldPreserveResume}`
    );

    throw error;
  }
};

export const getUnprocessedEmails = async (
  gmailAccountId: string,
  limit: number = 50
): Promise<any[]> => {
  const result = await query(
    `SELECT id, gmail_message_id, subject, sender_email, body_text, body_html, received_at
     FROM emails
     WHERE gmail_account_id = $1 AND processed_at IS NULL
     ORDER BY received_at DESC
     LIMIT $2`,
    [gmailAccountId, limit]
  );

  return result.rows;
};

export const markEmailAsProcessed = async (
  emailId: string,
  isSubscription: boolean,
  confidence: number,
  extractedData: any
): Promise<void> => {
  await query(
    `UPDATE emails
     SET processed_at = CURRENT_TIMESTAMP,
         is_subscription = $1,
         subscription_confidence = $2,
         extracted_data = $3
     WHERE id = $4`,
    [isSubscription, confidence, JSON.stringify(extractedData), emailId]
  );
};
