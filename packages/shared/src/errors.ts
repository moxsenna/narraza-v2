export type UseCaseErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'JOB_ALREADY_ACTIVE'
  | 'INSUFFICIENT_CREDIT'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_CONSUMED'
  | 'TERMINAL_STATE_CONFLICT'
  | 'STALE_PROPOSAL'
  | 'CAS_CONFLICT'
  | 'RESERVATION_EXPOSURE_EXCEEDED'
  | 'INTERNAL';

export class InternalUseCaseError extends Error {
  constructor(
    public readonly code: UseCaseErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InternalUseCaseError';
  }
}

export class PublicUseCaseError extends Error {
  constructor(
    public readonly code: Exclude<UseCaseErrorCode, 'INTERNAL'>,
    message: string,
  ) {
    super(message);
    this.name = 'PublicUseCaseError';
  }
}

export function toPublicError(err: unknown): PublicUseCaseError {
  if (err instanceof PublicUseCaseError) return err;
  if (err instanceof InternalUseCaseError) {
    if (err.code === 'INTERNAL') {
      return new PublicUseCaseError('NOT_FOUND', 'Not found');
    }
    return new PublicUseCaseError(
      err.code as Exclude<UseCaseErrorCode, 'INTERNAL'>,
      err.message,
    );
  }
  return new PublicUseCaseError('NOT_FOUND', 'Not found');
}
