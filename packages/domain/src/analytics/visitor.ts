export type ReferralCategory = 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'EMAIL' | 'CAMPAIGN' | 'REFERRAL';
export type DeviceCategory = 'MOBILE' | 'TABLET' | 'DESKTOP' | 'BOT' | 'UNKNOWN';

export interface VisitorProfile {
  visitorId: string;
  firstVisit: Date;
  lastVisit: Date;
  landingPage: string;
  referralCategory: ReferralCategory;
  campaignSource?: string | undefined;
  campaignMedium?: string | undefined;
  campaignName?: string | undefined;
  deviceCategory: DeviceCategory;
  browserFamily: string;
  osFamily: string;
  language?: string | undefined;
  /** Approximate country/region from a trusted edge header; never derived from a stored IP. */
  region?: string | undefined;
  consentStatus: 'ANALYTICS_GRANTED';
}

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu)\./i;
const SOCIAL_HOSTS =
  /(^|\.)(facebook|instagram|linkedin|twitter|x|t|youtube|pinterest|reddit|whatsapp)\.(com|co|me)$|^(l|lm)\.facebook\.com$/i;

export function classifyReferral(input: {
  referrerHost?: string | undefined;
  ownHost?: string | undefined;
  utmMedium?: string | undefined;
}): ReferralCategory {
  const medium = input.utmMedium?.toLowerCase();
  if (medium) {
    if (/(cpc|ppc|paid|display|banner)/.test(medium)) return 'CAMPAIGN';
    if (medium === 'email') return 'EMAIL';
    if (/(social|sm)/.test(medium)) return 'SOCIAL';
    if (/(organic|search)/.test(medium)) return 'SEARCH';
    return 'CAMPAIGN';
  }
  const host = input.referrerHost?.toLowerCase();
  if (!host || host === input.ownHost?.toLowerCase()) return 'DIRECT';
  if (SEARCH_HOSTS.test(host)) return 'SEARCH';
  if (SOCIAL_HOSTS.test(host)) return 'SOCIAL';
  return 'REFERRAL';
}

export interface ClientHints {
  deviceCategory: DeviceCategory;
  browserFamily: string;
  osFamily: string;
}

/** Coarse user-agent classification. Raw user-agent strings are never stored. */
export function classifyUserAgent(ua: string | undefined): ClientHints {
  if (!ua) return { deviceCategory: 'UNKNOWN', browserFamily: 'Unknown', osFamily: 'Unknown' };
  const s = ua.toLowerCase();

  if (/bot|crawl|spider|slurp|headless|lighthouse/.test(s)) {
    return { deviceCategory: 'BOT', browserFamily: 'Bot', osFamily: 'Unknown' };
  }

  const deviceCategory: DeviceCategory = /ipad|tablet|(android(?!.*mobile))/.test(s)
    ? 'TABLET'
    : /mobi|iphone|android/.test(s)
      ? 'MOBILE'
      : 'DESKTOP';

  const browserFamily = /edg(e|a|ios)?\//.test(s)
    ? 'Edge'
    : /opr\/|opera/.test(s)
      ? 'Opera'
      : /samsungbrowser/.test(s)
        ? 'Samsung Internet'
        : /firefox|fxios/.test(s)
          ? 'Firefox'
          : /chrome|crios/.test(s)
            ? 'Chrome'
            : /safari/.test(s)
              ? 'Safari'
              : 'Other';

  const osFamily = /windows/.test(s)
    ? 'Windows'
    : /android/.test(s)
      ? 'Android'
      : /iphone|ipad|ipod|ios/.test(s)
        ? 'iOS'
        : /mac os|macintosh/.test(s)
          ? 'macOS'
          : /linux|cros/.test(s)
            ? 'Linux'
            : 'Other';

  return { deviceCategory, browserFamily, osFamily };
}

/** Strips query/fragment so coordinates or personal data in URLs can never be stored. */
export function sanitizeLandingPath(path: string): string {
  const clean = (path.split(/[?#]/)[0] ?? '/').slice(0, 200);
  return /^\/[A-Za-z0-9/_\-.]*$/.test(clean) ? clean : '/';
}
