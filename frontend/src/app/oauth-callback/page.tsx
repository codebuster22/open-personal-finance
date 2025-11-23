"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing...");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state"); // This is the credentialId

      console.log("[OAuth Callback Page] Starting OAuth callback...");
      console.log("[OAuth Callback Page] Code:", code ? `${code.substring(0, 20)}...` : "MISSING");
      console.log("[OAuth Callback Page] State (credentialId):", state);

      if (!code || !state) {
        console.error("[OAuth Callback Page] Missing parameters!");
        setError("Invalid callback parameters");
        return;
      }

      try {
        setStatus("Exchanging authorization code...");
        console.log("[OAuth Callback Page] Calling API handleOAuthCallback...");

        const result = await api.handleOAuthCallback(code, state);
        console.log("[OAuth Callback Page] ✓ OAuth callback successful:", result);

        setStatus("Account connected successfully! Redirecting...");
        console.log("[OAuth Callback Page] Redirecting to settings in 2 seconds...");

        setTimeout(() => {
          console.log("[OAuth Callback Page] Navigating to /settings");
          router.push("/settings");
        }, 2000);
      } catch (err: any) {
        console.error("[OAuth Callback Page] ❌ OAuth callback failed:", err);
        setError(err.message || "Failed to complete OAuth flow");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <>
      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="text-center">
          <div className="animate-pulse mb-2">{status}</div>
        </div>
      )}
    </>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OAuth Callback</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
            <OAuthCallbackContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
