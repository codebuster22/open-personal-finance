import { query } from "../config/database";
import { getGmailAccountById, getOAuthCredentialById, updateGmailAccountTokens, updateGmailAccountSyncStatus } from "./oauthService";
import { decrypt } from "../config/encryption";
import { AppError } from "../middleware/errorHandler";

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
  maxResults: number = 100,
  pageToken?: string
): Promise<{ emails: any[]; nextPageToken?: string }> => {
  const accessToken = await getAccessToken(accountId, userId);

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", maxResults.toString());
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

export const syncGmailAccount = async (
  accountId: string,
  userId: string
): Promise<{ processed: number; total: number }> => {
  await updateGmailAccountSyncStatus(accountId, "syncing");

  let processed = 0;
  let total = 0;
  let pageToken: string | undefined;

  try {
    // First pass: count total emails
    const initialFetch = await fetchEmails(accountId, userId, 1);

    // Fetch all emails
    do {
      const { emails, nextPageToken } = await fetchEmails(accountId, userId, 100, pageToken);
      total += emails.length;
      pageToken = nextPageToken;
    } while (pageToken);

    await updateGmailAccountSyncStatus(accountId, "syncing", total, 0);

    // Reset for processing
    pageToken = undefined;

    // Second pass: fetch and save email details
    do {
      const { emails, nextPageToken } = await fetchEmails(accountId, userId, 100, pageToken);

      for (const email of emails) {
        try {
          const details = await fetchEmailDetails(accountId, userId, email.id);
          await saveEmail(accountId, details);
          processed++;

          // Update progress every 10 emails
          if (processed % 10 === 0) {
            await updateGmailAccountSyncStatus(accountId, "syncing", total, processed);
          }
        } catch (error) {
          console.error(`Failed to process email ${email.id}:`, error);
        }
      }

      pageToken = nextPageToken;

      // Rate limiting: small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (pageToken);

    await updateGmailAccountSyncStatus(accountId, "completed", total, processed);

    return { processed, total };
  } catch (error) {
    await updateGmailAccountSyncStatus(accountId, "error");
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
