"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Settings, LogOut, DollarSign, TrendingUp, RefreshCw } from "lucide-react";

interface Subscription {
  id: string;
  service_name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string | null;
  status: string;
  category_name?: string;
  category_color?: string;
}

interface Stats {
  totalMonthly: number;
  totalYearly: number;
  activeCount: number;
  categoryBreakdown: Array<{ category: string; amount: number; count: number }>;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [gmailAccounts, setGmailAccounts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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
      const [subsData, statsData, accountsData] = await Promise.all([
        api.getSubscriptions(),
        api.getSubscriptionStats(),
        api.getGmailAccounts(),
      ]);
      setSubscriptions(subsData.subscriptions);
      setStats(statsData.stats);
      setGmailAccounts(accountsData.accounts);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
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
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">Subscription Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalMonthly ? Number(stats.totalMonthly).toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeCount || 0} active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yearly Spend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalYearly ? Number(stats.totalYearly).toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">Projected annual cost</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gmail Accounts</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gmailAccounts.length}</div>
              <p className="text-xs text-muted-foreground">
                {gmailAccounts.length === 0 ? (
                  <Link href="/settings" className="text-primary hover:underline">
                    Connect your first account
                  </Link>
                ) : (
                  "Connected accounts"
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Subscriptions</CardTitle>
              <CardDescription>
                Manage your recurring subscriptions
              </CardDescription>
            </div>
            <Link href="/settings">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading subscriptions...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No subscriptions found yet.
                </p>
                <Link href="/settings">
                  <Button variant="outline">
                    Connect Gmail Account to Auto-Detect
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sub.category_color || "#10B981" }}
                      />
                      <div>
                        <h3 className="font-medium">{sub.service_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {sub.category_name || "Uncategorized"} • {sub.billing_cycle}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${Number(sub.amount).toFixed(2)} {sub.currency}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {sub.status}
                      </div>
                    </div>
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
