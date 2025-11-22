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

      if (!code || !state) {
        setError("Invalid callback parameters");
        return;
      }

      try {
        setStatus("Exchanging authorization code...");
        await api.handleOAuthCallback(code, state);
        setStatus("Account connected successfully! Redirecting...");
        setTimeout(() => router.push("/settings"), 2000);
      } catch (err: any) {
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
