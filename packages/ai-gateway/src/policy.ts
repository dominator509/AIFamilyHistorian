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

const injectionPatterns = [
  /ignore (all|any|the) previous instructions?/iu,
  /reveal (the )?(system|developer) prompt/iu,
  /act as (the )?(system|developer)/iu,
  /<\/?(?:system|developer|tool)>/iu,
];

const sensitivePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\b(?:sk|pk)[_-][a-zA-Z0-9_-]{20,}\b/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/gu,
];

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
  if (injectionPatterns.some((pattern) => pattern.test(input.text)))
    throw new ProviderPolicyError(
      'PROVIDER_POLICY_REJECTED',
      'Prompt-injection content cannot cross the provider boundary',
    );

  let redactions = 0;
  let outboundText = input.text;
  for (const pattern of sensitivePatterns) {
    outboundText = outboundText.replace(pattern, () => {
      redactions += 1;
      return '[REDACTED]';
    });
  }
  return { outboundText, redactions };
}
