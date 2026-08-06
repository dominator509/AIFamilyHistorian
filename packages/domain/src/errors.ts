import type { ProblemCode } from '@family-historian/contracts';

export class DomainError extends Error {
  public constructor(
    public readonly code: ProblemCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
