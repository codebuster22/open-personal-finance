import { markEmailAsProcessed } from "./gmailService";
import { createSubscription } from "./subscriptionService";

interface ExtractedSubscription {
  isSubscription: boolean;
  confidence: number;
  serviceName?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  nextBillingDate?: string;
}

// Simple rule-based subscription detection (can be replaced with Claude API)
export const analyzeEmail = async (
  email: {
    id: string;
    subject: string;
    sender_email: string;
    body_text: string;
    body_html: string;
  }
): Promise<ExtractedSubscription> => {
  const text = email.body_text || email.body_html || "";
  const subject = email.subject || "";
  const sender = email.sender_email || "";

  // Keywords that indicate subscription emails
  const subscriptionKeywords = [
    "subscription",
    "recurring",
    "billing",
    "invoice",
    "payment",
    "renewal",
    "monthly charge",
    "annual charge",
    "auto-renewal",
    "membership",
  ];

  const billingKeywords = [
    "charged",
    "payment processed",
    "receipt",
    "invoice",
    "billing statement",
  ];

  // Common subscription service patterns
  const servicePatterns: Record<string, RegExp> = {
    Netflix: /netflix/i,
    Spotify: /spotify/i,
    "Amazon Prime": /amazon\s*prime/i,
    "Disney+": /disney\+/i,
    "HBO Max": /hbo\s*max/i,
    YouTube: /youtube\s*(premium|music)/i,
    Hulu: /hulu/i,
    "Apple Music": /apple\s*music/i,
    iCloud: /icloud/i,
    Dropbox: /dropbox/i,
    GitHub: /github/i,
    Slack: /slack/i,
    Zoom: /zoom/i,
    Adobe: /adobe/i,
    Microsoft: /microsoft\s*365|office\s*365/i,
    Google: /google\s*one|google\s*workspace/i,
  };

  // Check for subscription indicators
  const combinedText = `${subject} ${text} ${sender}`.toLowerCase();
  let confidence = 0;
  let isSubscription = false;

  // Check for subscription keywords
  for (const keyword of subscriptionKeywords) {
    if (combinedText.includes(keyword)) {
      confidence += 0.15;
    }
  }

  // Check for billing keywords
  for (const keyword of billingKeywords) {
    if (combinedText.includes(keyword)) {
      confidence += 0.1;
    }
  }

  // Detect service name
  let serviceName: string | undefined;
  for (const [service, pattern] of Object.entries(servicePatterns)) {
    if (pattern.test(combinedText)) {
      serviceName = service;
      confidence += 0.3;
      break;
    }
  }

  // Extract amount using regex
  const amountPatterns = [
    /\$(\d+(?:\.\d{2})?)/,
    /USD\s*(\d+(?:\.\d{2})?)/,
    /(\d+(?:\.\d{2})?)\s*USD/,
  ];

  let amount: number | undefined;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseFloat(match[1]);
      confidence += 0.2;
      break;
    }
  }

  // Detect billing cycle
  let billingCycle = "monthly";
  if (/annual|yearly|per\s*year/i.test(combinedText)) {
    billingCycle = "yearly";
  } else if (/weekly|per\s*week/i.test(combinedText)) {
    billingCycle = "weekly";
  }

  // Normalize confidence
  confidence = Math.min(confidence, 1);

  if (confidence > 0.4) {
    isSubscription = true;
  }

  return {
    isSubscription,
    confidence,
    serviceName,
    amount,
    currency: "USD",
    billingCycle,
  };
};

export const processEmailWithAI = async (
  userId: string,
  email: {
    id: string;
    subject: string;
    sender_email: string;
    body_text: string;
    body_html: string;
  }
): Promise<void> => {
  const result = await analyzeEmail(email);

  await markEmailAsProcessed(
    email.id,
    result.isSubscription,
    result.confidence,
    result
  );

  // If high confidence subscription detected, create subscription record
  if (result.isSubscription && result.confidence > 0.6 && result.serviceName && result.amount) {
    await createSubscription(userId, {
      emailId: email.id,
      serviceName: result.serviceName,
      amount: result.amount,
      currency: result.currency,
      billingCycle: result.billingCycle!,
      confidenceScore: result.confidence,
    });
  }
};

export const processUnprocessedEmails = async (
  userId: string,
  gmailAccountId: string
): Promise<number> => {
  const { getUnprocessedEmails } = await import("./gmailService");
  const emails = await getUnprocessedEmails(gmailAccountId);

  let processed = 0;
  for (const email of emails) {
    try {
      await processEmailWithAI(userId, email);
      processed++;
    } catch (error) {
      console.error(`Failed to process email ${email.id}:`, error);
    }
  }

  return processed;
};
