"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, ExternalLink, RefreshCw } from "lucide-react";

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
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [credentials, setCredentials] = useState<OAuthCredential[]>([]);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [newCredential, setNewCredential] = useState({
    credentialName: "",
    clientId: "",
    clientSecret: "",
    redirectUri: typeof window !== "undefined" ? `${window.location.origin}/oauth-callback` : "",
  });
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

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
      setAccounts(accountsData.accounts);
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
      alert("Sync started! This may take a few minutes.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to start sync");
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
            <CardTitle>Connected Gmail Accounts</CardTitle>
            <CardDescription>
              Gmail accounts connected for subscription detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No Gmail accounts connected yet. Add OAuth credentials first, then click
                "Connect Account".
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">{account.email}</h3>
                      <p className="text-sm text-muted-foreground">
                        Status: {account.sync_status} •{" "}
                        {account.processed_emails}/{account.total_emails} emails processed
                      </p>
                      {account.last_sync && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {new Date(account.last_sync).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleSyncAccount(account.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
