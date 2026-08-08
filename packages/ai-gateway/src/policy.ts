export type ProcessingPurpose =
  'transcription' | 'fact_extraction' | 'chapter_drafting' | 'interview_planning' | 'narration';

export interface PolicyInput {
  purpose: ProcessingPurpose;
  consentPurposes: readonly ProcessingPurpose[];
  aiProcessingEnabled: boolean;
  text: string;
}

export interface PolicyResult {
  outboundText: string;
  redactions: number;
}

export interface SanitizedValue {
  value: unknown;
  redactions: number;
}

const injectionPatterns = [
  /ignore (all|any|the) previous instructions?/iu,
  /reveal (the )?(system|developer) prompt/iu,
  /act as (the )?(system|developer)/iu,
  /<\/?(?:system|developer|tool)>/iu,
];

const sensitivePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\b(?:sk|pk|rk|whsec|re|dg|gsk)[_-][a-zA-Z0-9_.-]{12,}\b/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/gu,
];

function redactText(text: string): { text: string; redactions: number } {
  let redactions = 0;
  let value = text;
  for (const pattern of sensitivePatterns) {
    value = value.replace(pattern, () => {
      redactions += 1;
      return '[REDACTED]';
    });
  }
  return { text: value, redactions };
}

export function containsPromptInjection(text: string): boolean {
  return injectionPatterns.some((pattern) => pattern.test(text));
}

export function sanitizeOutboundValue(value: unknown, depth = 0): SanitizedValue {
  if (depth > 8) return { value: '[REDACTED_DEPTH]', redactions: 1 };
  if (typeof value === 'string') {
    const result = redactText(value);
    return { value: result.text, redactions: result.redactions };
  }
  if (Array.isArray(value)) {
    let redactions = 0;
    const sanitized = value.map((item) => {
      const result = sanitizeOutboundValue(item, depth + 1);
      redactions += result.redactions;
      return result.value;
    });
    return { value: sanitized, redactions };
  }
  if (value !== null && typeof value === 'object') {
    let redactions = 0;
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const result = sanitizeOutboundValue(nested, depth + 1);
      redactions += result.redactions;
      sanitized[key] = result.value;
    }
    return { value: sanitized, redactions };
  }
  return { value, redactions: 0 };
}

export class ProviderPolicyError extends Error {
  public constructor(
    public readonly code: 'CONSENT_REQUIRED' | 'CONSENT_WITHDRAWN' | 'PROVIDER_POLICY_REJECTED',
    message: string,
  ) {
    super(message);
  }
}

export function enforceOutboundPolicy(input: PolicyInput): PolicyResult {
  if (!input.aiProcessingEnabled)
    throw new ProviderPolicyError('CONSENT_REQUIRED', 'AI processing is disabled for this archive');
  if (!input.consentPurposes.includes(input.purpose))
    throw new ProviderPolicyError(
      'CONSENT_WITHDRAWN',
      'Current purpose-specific consent is required',
    );
  if (containsPromptInjection(input.text))
    throw new ProviderPolicyError(
      'PROVIDER_POLICY_REJECTED',
      'Prompt-injection content cannot cross the provider boundary',
    );

  const result = redactText(input.text);
  return { outboundText: result.text, redactions: result.redactions };
}
