/**
 * Claude Service
 * Interface with Anthropic Claude API for email analysis
 */

import {
  ANTHROPIC_API_KEY,
  AI_ENABLED,
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  CLAUDE_TEMPERATURE,
  CLAUDE_API_VERSION,
  CLAUDE_API_URL,
  EMAIL_CONTENT_MAX_LENGTH,
  SUBSCRIPTION_ANALYSIS_PROMPT,
  HAIKU_INPUT_COST_PER_1M,
  HAIKU_OUTPUT_COST_PER_1M,
} from "../config/aiConfig";

// ===========================
// Types
// ===========================

export interface EmailAnalysisResult {
  is_subscription: boolean;
  confidence: number;
  service_name: string | null;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_billing_date: string | null;
  reasoning: string;
  tokens_used: {
    input: number;
    output: number;
  };
}

interface ClaudeAPIResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ===========================
// Main Analysis Function
// ===========================

/**
 * Analyze email with Claude API
 * @throws Error if API is not configured or if analysis fails after retries
 */
export async function analyzeEmailWithClaude(email: {
  id: string;
  subject: string;
  sender_email: string;
  body_text: string | null;
  body_html: string | null;
  received_at: Date;
}): Promise<EmailAnalysisResult> {
  // Step 1: Check API availability
  if (!AI_ENABLED) {
    throw new Error("Claude API not configured - ANTHROPIC_API_KEY missing");
  }

  // Step 2: Prepare email content
  const emailContent = prepareEmailContent(email);

  // Step 3: Build prompt
  const prompt = buildPrompt(email, emailContent);

  // Step 4: Call Claude API with retries
  const response = await callClaudeAPIWithRetries(prompt);

  // Step 5: Parse and validate response
  const result = parseClaudeResponse(response);

  // Step 6: Return structured result
  return result;
}

// ===========================
// Email Content Preparation
// ===========================

/**
 * Prepare email content for Claude analysis
 * - Prefer plain text over HTML
 * - Strip HTML tags if only HTML available
 * - Truncate to max length
 */
function prepareEmailContent(email: {
  body_text: string | null;
  body_html: string | null;
}): string {
  let content = "";

  // Prefer body_text over body_html
  if (email.body_text) {
    content = email.body_text;
  } else if (email.body_html) {
    // Strip HTML tags
    content = stripHtmlTags(email.body_html);
  } else {
    content = "[No email body content]";
  }

  // Truncate to max length (preserve beginning - most important info at top)
  if (content.length > EMAIL_CONTENT_MAX_LENGTH) {
    content = content.substring(0, EMAIL_CONTENT_MAX_LENGTH) + "\n\n[Content truncated...]";
  }

  return content;
}

/**
 * Simple HTML tag stripper
 * Removes script/style tags and their content, replaces block elements with newlines
 */
function stripHtmlTags(html: string): string {
  let text = html;

  // Remove script and style tags with their content
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Replace common block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
  text = text.trim();

  return text;
}

// ===========================
// Prompt Building
// ===========================

/**
 * Build Claude prompt from template with email data
 */
function buildPrompt(
  email: {
    subject: string;
    sender_email: string;
    received_at: Date;
  },
  emailContent: string
): string {
  return SUBSCRIPTION_ANALYSIS_PROMPT.replace("{subject}", email.subject || "[No subject]")
    .replace("{sender}", email.sender_email || "[Unknown sender]")
    .replace("{date}", email.received_at.toISOString())
    .replace("{body}", emailContent);
}

// ===========================
// Claude API Calls
// ===========================

/**
 * Call Claude API with exponential backoff retry logic
 */
async function callClaudeAPIWithRetries(prompt: string, maxRetries = 3): Promise<ClaudeAPIResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callClaudeAPI(prompt);
    } catch (error) {
      lastError = error as Error;

      // Don't retry auth errors
      if (error instanceof Error && error.message.includes("401")) {
        console.error("[Claude API] Invalid API key - not retrying");
        throw error;
      }

      // Check if we should retry
      if (attempt < maxRetries) {
        const isRateLimitError = error instanceof Error && error.message.includes("429");
        const isServerError = error instanceof Error && (error.message.includes("500") || error.message.includes("503"));

        if (isRateLimitError || isServerError) {
          // Exponential backoff: 10s, 30s, 90s
          const delays = [10000, 30000, 90000];
          const delay = delays[attempt - 1] || 10000;

          console.log(`[Claude API] Retry ${attempt}/${maxRetries} after ${delay}ms - Error: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // For other errors or last attempt, throw
      console.error(`[Claude API] Attempt ${attempt}/${maxRetries} failed:`, error);
    }
  }

  throw lastError || new Error("Claude API call failed after retries");
}

/**
 * Make actual API call to Claude
 */
async function callClaudeAPI(prompt: string): Promise<ClaudeAPIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": CLAUDE_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        temperature: CLAUDE_TEMPERATURE,
        system: prompt,
        messages: [
          {
            role: "user",
            content: "Please analyze this email.",
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data as ClaudeAPIResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Claude API request timeout");
    }

    throw error;
  }
}

// ===========================
// Response Parsing
// ===========================

/**
 * Parse and validate Claude API response
 */
function parseClaudeResponse(response: ClaudeAPIResponse): EmailAnalysisResult {
  // Extract text from response
  if (!response.content || response.content.length === 0) {
    throw new Error("Empty response from Claude API");
  }

  let text = response.content[0].text;

  // Strip markdown formatting if present
  text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    // Try to repair common JSON issues
    const repaired = repairJSON(text);
    try {
      parsed = JSON.parse(repaired);
    } catch {
      throw new Error(`Failed to parse Claude response as JSON: ${text.substring(0, 200)}`);
    }
  }

  // Validate structure
  validateAnalysisResult(parsed);

  // Extract token usage
  const tokens_used = {
    input: response.usage?.input_tokens || 0,
    output: response.usage?.output_tokens || 0,
  };

  return {
    is_subscription: parsed.is_subscription,
    confidence: parsed.confidence,
    service_name: parsed.service_name || null,
    amount: parsed.amount || null,
    currency: parsed.currency || null,
    billing_cycle: parsed.billing_cycle || null,
    next_billing_date: parsed.next_billing_date || null,
    reasoning: parsed.reasoning || "No reasoning provided",
    tokens_used,
  };
}

/**
 * Attempt to repair common JSON issues
 */
function repairJSON(text: string): string {
  let repaired = text;

  // Remove trailing commas
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

  // Add missing closing brace
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    repaired += "}".repeat(openBraces - closeBraces);
  }

  return repaired;
}

/**
 * Validate that parsed result has required fields with correct types
 */
function validateAnalysisResult(result: any): void {
  if (typeof result !== "object" || result === null) {
    throw new Error("Analysis result must be an object");
  }

  if (typeof result.is_subscription !== "boolean") {
    throw new Error("is_subscription must be a boolean");
  }

  if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
    throw new Error("confidence must be a number between 0 and 1");
  }

  // Optional fields - validate type if present
  if (result.service_name !== null && typeof result.service_name !== "string") {
    throw new Error("service_name must be a string or null");
  }

  if (result.amount !== null && typeof result.amount !== "number") {
    throw new Error("amount must be a number or null");
  }

  if (result.currency !== null && typeof result.currency !== "string") {
    throw new Error("currency must be a string or null");
  }

  if (result.billing_cycle !== null && typeof result.billing_cycle !== "string") {
    throw new Error("billing_cycle must be a string or null");
  }

  if (result.next_billing_date !== null) {
    if (typeof result.next_billing_date !== "string") {
      throw new Error("next_billing_date must be a string or null");
    }
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.next_billing_date)) {
      throw new Error("next_billing_date must match YYYY-MM-DD format");
    }
  }

  if (typeof result.reasoning !== "string") {
    throw new Error("reasoning must be a string");
  }
}

// ===========================
// Cost Calculation
// ===========================

/**
 * Calculate cost based on token usage
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @returns Cost in USD (rounded to 6 decimal places)
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_1M;
  const totalCost = inputCost + outputCost;

  // Round to 6 decimal places
  return Math.round(totalCost * 1_000_000) / 1_000_000;
}
