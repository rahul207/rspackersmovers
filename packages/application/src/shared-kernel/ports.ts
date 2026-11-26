import type { ErrorCode } from '@rs/shared';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
  /** Cryptographically secure integer in [0, maxExclusive). */
  randomInt(maxExclusive: number): number;
}

/** Structured logger. Callers must never pass personal data (names, phones, addresses, coordinates). */
export interface Logger {
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}

/** Runs `work` once per key; concurrent and repeated calls inside the TTL share the first result. */
export interface IdempotencyStore {
  run<T>(key: string, work: () => Promise<T>): Promise<T>;
}

export interface CaptchaVerifier {
  readonly provider: 'none' | 'turnstile';
  verify(token: string | undefined): Promise<boolean>;
}

/** Errors that the presentation layer maps to typed, sanitised API errors. */
export class ApplicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export interface BotProtectionInput {
  website?: string | undefined;
  captchaToken?: string | undefined;
}

export async function enforceBotProtection(
  input: BotProtectionInput,
  captcha: CaptchaVerifier,
): Promise<void> {
  if (input.website && input.website.trim() !== '') {
    throw new ApplicationError('SUBMISSION_REJECTED', 'Your submission could not be accepted.');
  }
  if (!(await captcha.verify(input.captchaToken))) {
    throw new ApplicationError('CAPTCHA_FAILED', 'Please complete the verification and try again.');
  }
}

export interface Purgeable {
  /** Deletes records created/last seen before the cutoff; returns the number removed. */
  deleteOlderThan(cutoff: Date): Promise<number>;
}
