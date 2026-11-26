import type { AnalyticsEventPayload } from '@rs/shared';
import {
  canRecordAnalytics,
  classifyReferral,
  classifyUserAgent,
  sanitizeLandingPath,
  type ConsentPreferences,
  type VisitorProfile,
} from '@rs/domain';
import type { Clock } from '../shared-kernel/ports';
import type { VisitorAnalyticsRepository } from './ports';

export interface TrackVisitContext {
  /** Decision proven by the signed consent cookie, not by the request body. */
  consent: Pick<ConsentPreferences, 'analytics'> | undefined;
  visitorId: string | undefined;
  userAgent?: string | undefined;
  acceptLanguage?: string | undefined;
  /** From a trusted edge header (e.g. CDN country header). Never from a stored IP. */
  region?: string | undefined;
  ownHost?: string | undefined;
}

export class TrackVisit {
  constructor(private readonly deps: { visitors: VisitorAnalyticsRepository; clock: Clock }) {}

  /** Returns false (and stores nothing) unless analytics consent is proven. */
  async execute(event: AnalyticsEventPayload, ctx: TrackVisitContext): Promise<boolean> {
    if (!canRecordAnalytics(ctx.consent) || !ctx.visitorId) return false;

    let referrerHost: string | undefined;
    if (event.referrer) {
      try {
        referrerHost = new URL(event.referrer).hostname;
      } catch {
        referrerHost = undefined;
      }
    }
    const hints = classifyUserAgent(ctx.userAgent);
    if (hints.deviceCategory === 'BOT') return false;

    const language = (event.language ?? ctx.acceptLanguage?.split(',')[0] ?? '')
      .replace(/[^A-Za-z-]/g, '')
      .slice(0, 12);
    const now = this.deps.clock.now();
    const profile: VisitorProfile = {
      visitorId: ctx.visitorId,
      firstVisit: now,
      lastVisit: now,
      landingPage: sanitizeLandingPath(event.path),
      referralCategory: classifyReferral({
        referrerHost,
        ownHost: ctx.ownHost,
        utmMedium: event.utm?.medium,
      }),
      campaignSource: event.utm?.source,
      campaignMedium: event.utm?.medium,
      campaignName: event.utm?.campaign,
      deviceCategory: hints.deviceCategory,
      browserFamily: hints.browserFamily,
      osFamily: hints.osFamily,
      language: language || undefined,
      region: ctx.region?.replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || undefined,
      consentStatus: 'ANALYTICS_GRANTED',
    };
    await this.deps.visitors.recordVisit(profile);
    return true;
  }
}
