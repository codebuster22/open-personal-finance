/**
 * AI Configuration
 * Centralized configuration for AI-related features including Claude API integration
 */

// ===========================
// API Configuration
// ===========================

/**
 * Anthropic API Key from environment variable
 * If null: Claude API is disabled, falls back to keywords only
 */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || null;

/**
 * Simple boolean check: is Claude API available?
 */
export const AI_ENABLED = ANTHROPIC_API_KEY !== null;

// Log warning on startup if API key is missing
if (!AI_ENABLED) {
  console.warn("[AI Config] ANTHROPIC_API_KEY not found. Claude API disabled, using keywords only.");
}

// ===========================
// Model Configuration
// ===========================

/**
 * Claude model to use - Haiku is 10x cheaper than Sonnet
 */
export const CLAUDE_MODEL = "claude-3-haiku-20240307";

/**
 * Maximum tokens for Claude response (sufficient for JSON output)
 */
export const CLAUDE_MAX_TOKENS = 500;

/**
 * Temperature 0 for deterministic output
 */
export const CLAUDE_TEMPERATURE = 0;

/**
 * Claude API version
 */
export const CLAUDE_API_VERSION = "2023-06-01";

/**
 * Claude API endpoint
 */
export const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// ===========================
// Analysis Configuration
// ===========================

/**
 * Keyword confidence threshold for Stage 1 filter
 * < 0.3: reject immediately
 * >= 0.3: send to Claude for analysis
 * Sends ~15-20% of emails to Claude (cost optimization)
 */
export const KEYWORD_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Subscription auto-create confidence threshold
 * 0 = trust Claude completely - if is_subscription=true, create subscription
 * User can delete false positives manually
 */
export const SUBSCRIPTION_AUTO_CREATE_CONFIDENCE = 0;

/**
 * Maximum number of retries for API failures
 */
export const MAX_ANALYSIS_RETRIES = 3;

/**
 * Maximum email content length to send to Claude
 * Truncate email body to 4000 characters (balances context vs cost)
 */
export const EMAIL_CONTENT_MAX_LENGTH = 4000;

// ===========================
// Cost Configuration
// ===========================

/**
 * Haiku pricing: $0.25 per million input tokens
 */
export const HAIKU_INPUT_COST_PER_1M = 0.25;

/**
 * Haiku pricing: $1.25 per million output tokens
 */
export const HAIKU_OUTPUT_COST_PER_1M = 1.25;

// ===========================
// Processing Configuration
// ===========================

/**
 * Process emails in batches of 50
 * Updates progress after each batch
 */
export const PROCESSING_BATCH_SIZE = 50;

/**
 * Delay between batches (100ms)
 * Rate limiting, prevents overwhelming API
 * ~500 emails per minute
 */
export const PROCESSING_DELAY_MS = 100;

// ===========================
// Prompt Template
// ===========================

/**
 * Claude prompt template for subscription analysis
 * Placeholders: {subject}, {sender}, {date}, {body}
 */
export const SUBSCRIPTION_ANALYSIS_PROMPT = `You are an expert at analyzing emails to detect recurring subscriptions and billing.

TASK: Analyze this email and determine if it represents a RECURRING subscription or membership.

CRITICAL RULES:
- Only classify as subscription if it's RECURRING (monthly, yearly, weekly, quarterly)
- One-time purchases are NOT subscriptions
- Free trials that will auto-renew ARE subscriptions
- Payment confirmations for existing subscriptions ARE subscriptions
- Payment failure notices for subscriptions ARE subscriptions
- Renewal reminders ARE subscriptions
- Upgrade/downgrade notices for subscriptions ARE subscriptions

EMAIL DATA:
Subject: {subject}
From: {sender}
Received: {date}

Body:
{body}

OUTPUT: Return ONLY valid JSON with this exact structure:
{
  "is_subscription": boolean,
  "confidence": number (0.0 to 1.0),
  "service_name": string or null,
  "amount": number or null,
  "currency": string or null,
  "billing_cycle": "monthly" | "yearly" | "weekly" | "quarterly" | null,
  "next_billing_date": "YYYY-MM-DD" or null,
  "reasoning": string (1-2 sentences explaining classification)
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no additional text.`;
