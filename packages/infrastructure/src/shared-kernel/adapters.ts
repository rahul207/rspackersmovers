import { randomInt, randomUUID } from 'node:crypto';
import type { CaptchaVerifier, Clock, IdempotencyStore, IdGenerator } from '@rs/application';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
  randomInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}

interface Entry {
  promise: Promise<unknown>;
  expiresAt: number;
}

/** In-memory single-process idempotency store. Failed work is not remembered, so users can retry. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    this.sweep();
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) return existing.promise as Promise<T>;

    const promise = work();
    const entry: Entry = { promise, expiresAt: this.now() + this.ttlMs };
    this.entries.set(key, entry);
    promise.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return promise;
  }

  private sweep() {
    if (this.entries.size < 500) return;
    const t = this.now();
    for (const [k, v] of this.entries) if (v.expiresAt <= t) this.entries.delete(k);
  }
}

export class NoCaptchaVerifier implements CaptchaVerifier {
  readonly provider = 'none' as const;
  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** Cloudflare Turnstile server-side verification. Fails closed on any error. */
export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  readonly provider = 'turnstile' as const;

  constructor(
    private readonly secret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
      const res = await this.fetchImpl(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: this.secret, response: token }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { success?: boolean };
      return body.success === true;
    } catch {
      return false;
    }
  }
}
