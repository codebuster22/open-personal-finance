import { useState, useEffect, useRef, useCallback } from "react";

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

interface UseGmailAccountPollingReturn {
  accounts: GmailAccount[];
  isPolling: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
  manualRefresh: () => Promise<void>;
}

/**
 * Custom hook for polling Gmail account sync status
 *
 * Automatically polls for updates when any account is syncing or pending.
 * Pauses polling when browser tab is hidden to save resources.
 */
export function useGmailAccountPolling(
  initialAccounts: GmailAccount[],
  pollingInterval: number = 5000
): UseGmailAccountPollingReturn {
  const [accounts, setAccounts] = useState<GmailAccount[]>(initialAccounts);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const shouldBePollingRef = useRef(false);

  /**
   * Update accounts state when initialAccounts prop changes
   * This handles the case when data is refreshed externally (e.g., after OAuth callback)
   */
  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  /**
   * Determine if polling should be active based on account statuses
   * Poll during both sync and processing
   */
  const shouldPoll = useCallback((accountList: GmailAccount[]): boolean => {
    return accountList.some(
      (account) =>
        account.sync_status === "syncing" ||
        account.sync_status === "pending" ||
        account.processing_status === "analyzing"
    );
  }, []);

  /**
   * Fetch updated account data from API
   */
  const fetchAccounts = useCallback(async (): Promise<GmailAccount[]> => {
    try {
      const response = await fetch("/api/oauth/accounts", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data);
      setLastUpdateTime(new Date());
      setError(null);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch account status";
      setError(errorMessage);
      console.error("[GmailAccountPolling] Error fetching accounts:", err);
      // Return current accounts on error - don't clear
      return accounts;
    }
  }, [accounts]);

  /**
   * Start polling for account updates
   */
  const startPolling = useCallback(() => {
    if (intervalIdRef.current) {
      return; // Already polling
    }

    setIsPolling(true);
    shouldBePollingRef.current = true;

    intervalIdRef.current = setInterval(async () => {
      const updatedAccounts = await fetchAccounts();

      // Check if we should continue polling
      if (!shouldPoll(updatedAccounts)) {
        stopPolling();
      }
    }, pollingInterval);
  }, [fetchAccounts, shouldPoll, pollingInterval]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsPolling(false);
    shouldBePollingRef.current = false;
  }, []);

  /**
   * Manual refresh function exposed to parent component
   */
  const manualRefresh = useCallback(async () => {
    await fetchAccounts();
  }, [fetchAccounts]);

  /**
   * Effect: Auto-start polling when accounts change and any is syncing
   */
  useEffect(() => {
    if (shouldPoll(accounts) && !isPolling) {
      startPolling();
    } else if (!shouldPoll(accounts) && isPolling) {
      stopPolling();
    }
  }, [accounts, isPolling, shouldPoll, startPolling, stopPolling]);

  /**
   * Effect: Handle page visibility changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - pause polling but remember we should be polling
        if (isPolling) {
          stopPolling();
        }
      } else {
        // Page is visible - resume polling if we should be
        if (shouldBePollingRef.current && !isPolling) {
          startPolling();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPolling, startPolling, stopPolling]);

  /**
   * Effect: Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    accounts,
    isPolling,
    error,
    lastUpdateTime,
    manualRefresh,
  };
}
