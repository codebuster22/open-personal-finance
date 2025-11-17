import { query } from "../config/database";
import { encrypt, decrypt } from "../config/encryption";
import { AppError } from "../middleware/errorHandler";

export interface OAuthCredential {
  id: string;
  user_id: string;
  credential_name: string;
  client_id: string;
  client_secret_encrypted: string;
  redirect_uri: string;
  created_at: Date;
}

export interface GmailAccount {
  id: string;
  user_id: string;
  oauth_credential_id: string;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: Date;
  is_active: boolean;
  last_sync: Date;
  sync_status: string;
  total_emails: number;
  processed_emails: number;
}

export const createOAuthCredential = async (
  userId: string,
  credentialName: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthCredential> => {
  const encryptedSecret = encrypt(clientSecret);

  const result = await query(
    `INSERT INTO oauth_credentials (user_id, credential_name, client_id, client_secret_encrypted, redirect_uri)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, credential_name, client_id, redirect_uri, created_at`,
    [userId, credentialName, clientId, encryptedSecret, redirectUri]
  );

  return result.rows[0];
};

export const getOAuthCredentials = async (
  userId: string
): Promise<OAuthCredential[]> => {
  const result = await query(
    `SELECT id, user_id, credential_name, client_id, redirect_uri, created_at
     FROM oauth_credentials WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
};

export const getOAuthCredentialById = async (
  credentialId: string,
  userId: string
): Promise<OAuthCredential & { client_secret: string }> => {
  const result = await query(
    `SELECT * FROM oauth_credentials WHERE id = $1 AND user_id = $2`,
    [credentialId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("OAuth credential not found", 404);
  }

  const credential = result.rows[0];
  const clientSecret = decrypt(credential.client_secret_encrypted);

  return { ...credential, client_secret: clientSecret };
};

export const deleteOAuthCredential = async (
  credentialId: string,
  userId: string
): Promise<void> => {
  const result = await query(
    `DELETE FROM oauth_credentials WHERE id = $1 AND user_id = $2 RETURNING id`,
    [credentialId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("OAuth credential not found", 404);
  }
};

export const saveGmailAccount = async (
  userId: string,
  oauthCredentialId: string,
  email: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<GmailAccount> => {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  const result = await query(
    `INSERT INTO gmail_accounts (user_id, oauth_credential_id, email, access_token_encrypted, refresh_token_encrypted, token_expiry)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, email) DO UPDATE SET
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
       token_expiry = EXCLUDED.token_expiry,
       is_active = true
     RETURNING *`,
    [userId, oauthCredentialId, email, encryptedAccessToken, encryptedRefreshToken, expiresAt]
  );

  return result.rows[0];
};

export const getGmailAccounts = async (
  userId: string
): Promise<GmailAccount[]> => {
  const result = await query(
    `SELECT id, user_id, oauth_credential_id, email, token_expiry, is_active, last_sync, sync_status, total_emails, processed_emails
     FROM gmail_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
};

export const getGmailAccountById = async (
  accountId: string,
  userId: string
): Promise<GmailAccount & { access_token: string; refresh_token: string }> => {
  const result = await query(
    `SELECT * FROM gmail_accounts WHERE id = $1 AND user_id = $2`,
    [accountId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("Gmail account not found", 404);
  }

  const account = result.rows[0];
  const accessToken = account.access_token_encrypted
    ? decrypt(account.access_token_encrypted)
    : "";
  const refreshToken = account.refresh_token_encrypted
    ? decrypt(account.refresh_token_encrypted)
    : "";

  return { ...account, access_token: accessToken, refresh_token: refreshToken };
};

export const updateGmailAccountTokens = async (
  accountId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> => {
  const encryptedAccessToken = encrypt(accessToken);

  await query(
    `UPDATE gmail_accounts SET access_token_encrypted = $1, token_expiry = $2 WHERE id = $3`,
    [encryptedAccessToken, expiresAt, accountId]
  );
};

export const updateGmailAccountSyncStatus = async (
  accountId: string,
  status: string,
  totalEmails?: number,
  processedEmails?: number
): Promise<void> => {
  let queryText = `UPDATE gmail_accounts SET sync_status = $1, last_sync = CURRENT_TIMESTAMP`;
  const params: any[] = [status];

  if (totalEmails !== undefined) {
    queryText += `, total_emails = $${params.length + 1}`;
    params.push(totalEmails);
  }

  if (processedEmails !== undefined) {
    queryText += `, processed_emails = $${params.length + 1}`;
    params.push(processedEmails);
  }

  queryText += ` WHERE id = $${params.length + 1}`;
  params.push(accountId);

  await query(queryText, params);
};
