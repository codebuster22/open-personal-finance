import { Router, Response, NextFunction } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  createOAuthCredential,
  getOAuthCredentials,
  getOAuthCredentialById,
  deleteOAuthCredential,
  saveGmailAccount,
  getGmailAccounts,
} from "../services/oauthService";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create OAuth credential
router.post(
  "/credentials",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { credentialName, clientId, clientSecret, redirectUri } = req.body;

      if (!credentialName || !clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({
          status: "error",
          message: "All fields are required: credentialName, clientId, clientSecret, redirectUri",
        });
      }

      const credential = await createOAuthCredential(
        req.userId!,
        credentialName,
        clientId,
        clientSecret,
        redirectUri
      );

      res.status(201).json({
        status: "success",
        data: { credential },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all OAuth credentials
router.get(
  "/credentials",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const credentials = await getOAuthCredentials(req.userId!);

      res.json({
        status: "success",
        data: { credentials },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete OAuth credential
router.delete(
  "/credentials/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await deleteOAuthCredential(req.params.id, req.userId!);

      res.json({
        status: "success",
        message: "OAuth credential deleted",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Generate OAuth authorization URL
router.get(
  "/credentials/:id/auth-url",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const credential = await getOAuthCredentialById(req.params.id, req.userId!);

      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ];

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", credential.client_id);
      authUrl.searchParams.set("redirect_uri", credential.redirect_uri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", credential.id);

      res.json({
        status: "success",
        data: { authUrl: authUrl.toString() },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Handle OAuth callback
router.post(
  "/callback",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { code, credentialId } = req.body;
      console.log(`[OAuth Callback] Starting OAuth callback flow for credential: ${credentialId}`);

      if (!code || !credentialId) {
        console.error(`[OAuth Callback] Missing parameters - code: ${!!code}, credentialId: ${!!credentialId}`);
        return res.status(400).json({
          status: "error",
          message: "Code and credentialId are required",
        });
      }

      console.log(`[OAuth Callback] Fetching credential for user: ${req.userId}`);
      const credential = await getOAuthCredentialById(credentialId, req.userId!);
      console.log(`[OAuth Callback] Found credential: ${credential.credential_name}`);

      // Exchange code for tokens
      console.log(`[OAuth Callback] Exchanging authorization code for tokens...`);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: credential.client_id,
          client_secret: credential.client_secret,
          redirect_uri: credential.redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        console.error(`[OAuth Callback] Token exchange failed:`, error);
        throw new Error(`Token exchange failed: ${JSON.stringify(error)}`);
      }

      const tokens = await tokenResponse.json();
      console.log(`[OAuth Callback] Successfully exchanged code for tokens`);

      // Get user email from Google
      console.log(`[OAuth Callback] Fetching user info from Google...`);
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        console.error(`[OAuth Callback] Failed to get user info - status: ${userInfoResponse.status}`);
        throw new Error("Failed to get user info");
      }

      const userInfo = await userInfoResponse.json();
      console.log(`[OAuth Callback] Got user info for: ${userInfo.email}`);

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Save Gmail account
      console.log(`[OAuth Callback] Saving Gmail account for user ${req.userId}...`);
      const account = await saveGmailAccount(
        req.userId!,
        credentialId,
        userInfo.email,
        tokens.access_token,
        tokens.refresh_token,
        expiresAt
      );

      console.log(`[OAuth Callback] ✓ Successfully saved Gmail account: ${account.email} (ID: ${account.id})`);

      res.json({
        status: "success",
        data: { account },
      });
    } catch (error) {
      console.error(`[OAuth Callback] Error in callback flow:`, error);
      next(error);
    }
  }
);

// Get all Gmail accounts
router.get(
  "/accounts",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(`[OAuth] Fetching Gmail accounts for user: ${req.userId}`);
      const accounts = await getGmailAccounts(req.userId!);
      console.log(`[OAuth] Found ${accounts.length} Gmail account(s) for user ${req.userId}`);

      res.json({
        status: "success",
        data: { accounts },
      });
    } catch (error) {
      console.error(`[OAuth] Error fetching accounts:`, error);
      next(error);
    }
  }
);

export default router;
