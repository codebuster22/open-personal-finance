/**
 * Startup Service
 * Handles automatic resumption of interrupted syncs and processing on server start
 */

import { query } from "../config/database";
import { syncGmailAccount } from "./gmailService";
import { startEmailProcessing } from "./emailProcessor";

/**
 * Resume any interrupted syncs or processing sessions on startup
 * Called once when the server starts
 */
export async function resumeInterruptedTasks(): Promise<void> {
  console.log("[Startup] Checking for interrupted syncs and processing...");

  try {
    // Find all accounts with interrupted syncs or processing
    const result = await query(
      `SELECT id, email, user_id, sync_status, processing_status,
              processed_emails, total_emails
       FROM gmail_accounts
       WHERE sync_status = 'syncing' OR processing_status = 'analyzing'`
    );

    if (result.rows.length === 0) {
      console.log("[Startup] No interrupted tasks found");
      return;
    }

    console.log(`[Startup] Found ${result.rows.length} interrupted task(s)`);

    for (const account of result.rows) {
      const { id, email, user_id, sync_status, processing_status } = account;

      // Resume sync if interrupted
      if (sync_status === "syncing") {
        console.log(
          `[Startup] Resuming Gmail sync for ${email} (${account.processed_emails}/${account.total_emails})`
        );

        // Start sync in background
        syncGmailAccount(id, user_id).catch((error) => {
          console.error(`[Startup] Failed to resume sync for ${email}:`, error);
        });
      }

      // Resume processing if interrupted
      if (processing_status === "analyzing") {
        console.log(`[Startup] Resuming email processing for ${email}`);

        // Start processing in background
        startEmailProcessing(id, user_id).catch((error) => {
          console.error(`[Startup] Failed to resume processing for ${email}:`, error);
        });
      }
    }

    console.log("[Startup] All interrupted tasks queued for resumption");
  } catch (error) {
    console.error("[Startup] Error checking for interrupted tasks:", error);
    // Don't throw - allow server to start even if resume fails
  }
}
