import type { Container } from '../../../composition-root';
import type { AppEnv } from '../../../config/env';
import type { CsrfProtection } from './security';

export interface RouteContext {
  container: Container;
  csrf: CsrfProtection;
}

/** Stricter per-client limit for endpoints that write personal data. */
export const submissionRateLimit = (env: AppEnv) => ({
  rateLimit: { max: env.SUBMISSION_RATE_LIMIT_MAX, timeWindow: '1 minute' },
});
