"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useGmailAccountPolling } from "@/hooks/useGmailAccountPolling";

interface OAuthCredential {
  id: string;
  credential_name: string;
  client_id: string;
  redirect_uri: string;
  created_at: string;
}

interface GmailAccount {
  id: string;
  email: string;
  sync_status: string;
  total_emails: number;
  processed_emails: number;
  last_sync: string | null;
  last_error: string;
  is_initial_sync_complete: boolean;
  processing_status: string;
  emails_to_analyze: number;
  emails_analyzed: number;
  subscriptions_found: number;
  ai_cost_total: number;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [credentials, setCredentials] = useState<OAuthCredential[]>([]);
  const [initialAccounts, setInitialAccounts] = useState<GmailAccount[]>([]);
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [newCredential, setNewCredential] = useState({
    credentialName: "",
    clientId: "",
    clientSecret: "",
    redirectUri: typeof window !== "undefined" ? `${window.location.origin}/oauth-callback` : "",
  });
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  // Use polling hook for real-time account updates
  const {
    accounts,
    isPolling,
    error: pollingError,
    lastUpdateTime,
    manualRefresh,
  } = useGmailAccountPolling(initialAccounts, 5000);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [credsData, accountsData] = await Promise.all([
        api.getOAuthCredentials(),
        api.getGmailAccounts(),
      ]);
      setCredentials(credsData.credentials);
      setInitialAccounts(accountsData.accounts);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoadingAction(true);

    try {
      await api.createOAuthCredential(newCredential);
      setNewCredential({
        credentialName: "",
        clientId: "",
        clientSecret: "",
        redirectUri: `${window.location.origin}/oauth-callback`,
      });
      setShowAddCredential(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add credential");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential?")) return;

    try {
      await api.deleteOAuthCredential(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete credential");
    }
  };

  const handleConnectAccount = async (credentialId: string) => {
    try {
      const data = await api.getOAuthAuthUrl(credentialId);
      window.location.href = data.authUrl;
    } catch (err: any) {
      setError(err.message || "Failed to get auth URL");
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    try {
      await api.syncGmailAccount(accountId);
      // Polling will automatically start when status changes to "syncing"
      await manualRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to start sync");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/10 text-yellow-600">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "syncing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-600">
            <AlertCircle className="h-3 w-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-600">
            {status}
          </span>
        );
    }
  };

  const getProcessingStatusBadge = (status: string) => {
    switch (status) {
      case "analyzing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Analysis Complete
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-600">
            <AlertCircle className="h-3 w-3" />
            Analysis Failed
          </span>
        );
      default:
        return null; // Don't show badge for "idle"
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 rounded-md">
            {error}
          </div>
        )}

        {/* OAuth Credentials */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Google OAuth Credentials</CardTitle>
            <CardDescription>
              Add your Google Cloud OAuth credentials to connect Gmail accounts.
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1 inline-flex items-center"
              >
                Create in Google Cloud Console
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {credentials.length === 0 && !showAddCredential ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  No OAuth credentials configured yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4 mb-4">
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">{cred.credential_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Client ID: {cred.client_id.substring(0, 30)}...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Redirect URI: {cred.redirect_uri}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleConnectAccount(cred.id)}
                      >
                        Connect Account
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCredential(cred.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddCredential ? (
              <form onSubmit={handleAddCredential} className="space-y-4 border rounded-lg p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Credential Name</label>
                  <Input
                    placeholder="My Gmail OAuth"
                    value={newCredential.credentialName}
                    onChange={(e) =>
                      setNewCredential({ ...newCredential, credentialName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client ID</label>
                  <Input
                    placeholder="xxx.apps.googleusercontent.com"
                    value={newCredential.clientId}
                    onChange={(e) =>
                      setNewCredential({ ...newCredential, clientId: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Secret</label>
                  <Input
                    type="password"
                    placeholder="GOCSPX-..."
                    value={newCredential.clientSecret}
                    onChange={(e) =>
                      setNewCredential({ ...newCredential, clientSecret: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Redirect URI</label>
                  <Input
                    value={newCredential.redirectUri}
                    onChange={(e) =>
                      setNewCredential({ ...newCredential, redirectUri: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Add this URI to your Google Cloud OAuth consent screen
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loadingAction}>
                    {loadingAction ? "Adding..." : "Add Credential"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddCredential(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button onClick={() => setShowAddCredential(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add OAuth Credential
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Connected Gmail Accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connected Gmail Accounts</CardTitle>
                <CardDescription>
                  Gmail accounts connected for subscription detection
                </CardDescription>
              </div>
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Polling updates...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pollingError && (
              <div className="mb-4 p-3 text-sm text-yellow-600 bg-yellow-500/10 rounded-md">
                Polling error: {pollingError}. Retrying automatically...
              </div>
            )}

            {accounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No Gmail accounts connected yet. Add OAuth credentials first, then click
                "Connect Account".
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => {
                  const percentage =
                    account.total_emails > 0
                      ? Math.floor((account.processed_emails / account.total_emails) * 100)
                      : 0;
                  const isSyncing = account.sync_status === "syncing";

                  return (
                    <div
                      key={account.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{account.email}</h3>
                            {getStatusBadge(account.sync_status)}
                            {getProcessingStatusBadge(account.processing_status)}
                          </div>

                          {/* Sync progress information */}
                          {account.total_emails > 0 && (
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                {account.processed_emails.toLocaleString()} /{" "}
                                {account.total_emails.toLocaleString()} emails ({percentage}%)
                              </p>
                              {isSyncing && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Processing progress */}
                          {account.processing_status === "analyzing" && account.emails_to_analyze > 0 && (
                            <div className="space-y-1 mt-2">
                              <p className="text-sm text-muted-foreground">
                                Analyzing: {account.emails_analyzed.toLocaleString()} /{" "}
                                {account.emails_to_analyze.toLocaleString()} emails (
                                {Math.floor((account.emails_analyzed / account.emails_to_analyze) * 100)}%)
                              </p>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.floor((account.emails_analyzed / account.emails_to_analyze) * 100)}%`,
                                  }}
                                />
                              </div>
                              {account.subscriptions_found > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                  Found {account.subscriptions_found} subscription{account.subscriptions_found !== 1 ? "s" : ""} so far
                                </p>
                              )}
                            </div>
                          )}

                          {/* Processing completion message */}
                          {account.processing_status === "completed" && account.subscriptions_found > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Analysis complete - found {account.subscriptions_found} subscription{account.subscriptions_found !== 1 ? "s" : ""}
                            </p>
                          )}

                          {/* AI cost display */}
                          {account.ai_cost_total > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              AI analysis cost: ${account.ai_cost_total.toFixed(2)}
                            </p>
                          )}

                          {/* Error message */}
                          {account.sync_status === "error" && account.last_error && (
                            <div className="mt-2 p-2 text-sm text-red-600 bg-red-500/10 rounded">
                              {account.last_error}
                            </div>
                          )}

                          {/* Last sync time */}
                          {account.last_sync && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Last sync: {new Date(account.last_sync).toLocaleString()}
                            </p>
                          )}

                          {/* Sync type indicator */}
                          {!account.is_initial_sync_complete && account.sync_status === "syncing" && (
                            <p className="text-xs text-blue-600 mt-1">
                              Initial sync in progress (last 12 months)
                            </p>
                          )}
                          {account.is_initial_sync_complete && account.sync_status === "syncing" && (
                            <p className="text-xs text-blue-600 mt-1">
                              Incremental sync in progress (new emails only)
                            </p>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => handleSyncAccount(account.id)}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {lastUpdateTime && (
                  <p className="text-xs text-center text-muted-foreground">
                    Last updated: {lastUpdateTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
