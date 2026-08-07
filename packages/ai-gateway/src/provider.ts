export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface ProviderRequest {
  model: string;
  stablePrefix: string;
  dynamicInput: string;
  temperature: number;
}

export interface ProviderResponse {
  content: string;
  providerRequestId?: string;
  usage: ProviderUsage;
}

export interface AiProvider {
  readonly name: string;
  complete(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse>;
}
