import type { ErrorCode } from '../constants';
import type { LocationConfidence } from '../schemas/location';

/** Response envelope used by every API endpoint. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { correlationId: string };
}
export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  meta: { correlationId: string };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Returned for a created quote request. No price is ever included: quotations go via WhatsApp. */
export interface QuoteCreated {
  referenceNumber: string;
  createdAt: string;
  whatsapp: {
    /** Present only when a business WhatsApp number is configured. */
    url?: string;
    message: string;
  };
}

export interface ContactCreated {
  requestId: string;
  createdAt: string;
}

export interface ConsentRecorded {
  consentId: string;
  analytics: boolean;
  marketing: boolean;
  location: boolean;
}

/** One post office returned by the India Post PIN code directory. */
export interface PostOfficeEntry {
  /** Stable key within a lookup: `<pincode>:<name>`. */
  id: string;
  name: string;
  pincode: string;
  branchType?: string;
  deliveryStatus?: string;
  block?: string;
  district: string;
  state: string;
}

/** `GET /api/v1/locations/pincode/:pincode` */
export interface PincodeLookup {
  pincode: string;
  /** Empty when India Post has no post office for this PIN code. */
  offices: PostOfficeEntry[];
}

/** `GET /api/v1/locations/area?pincode=&name=&district=&state=` */
export interface ResolvedArea {
  pincode: string;
  name: string;
  district: string;
  state: string;
  /** Human-readable area line, e.g. `Paleikuda, Khorda, Odisha - 751002`. */
  areaLabel: string;
  latitude: number;
  longitude: number;
  /** high = the named place was found; medium = matched by name text; approximate = PIN/district centre. */
  confidence: LocationConfidence;
  source: 'open-meteo' | 'photon' | 'nominatim' | 'offline';
}

export interface PublicConfig {
  business: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    whatsappNumber?: string;
  };
  siteUrl: string;
  social: { network: string; url: string }[];
  policyLinks: {
    privacy: string;
    cookies: string;
    terms: string;
    cancellation: string;
    dataRequest: string;
  };
  features: {
    visitorAnalytics: boolean;
  };
  captcha: { provider: 'none' | 'turnstile'; siteKey?: string };
  consentVersion: string;
  privacyNoticeVersion: string;
  csrfToken: string;
}

export interface ContentService {
  id: string;
  title: string;
  description: string;
  icon: string;
}
export interface ContentFaq {
  id: string;
  question: string;
  answer: string;
}
export interface ContentClient {
  id: string;
  name: string;
  monogram: string;
  /** Always true: these are fictional demonstration clients. */
  isDemonstration: true;
}
export interface ContentTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  rating: number;
  /** Always true: fictional demonstration content, not a verified customer. */
  isDemonstration: true;
}
export interface SiteContent {
  services: ContentService[];
  faqs: ContentFaq[];
  clients: ContentClient[];
  testimonials: ContentTestimonial[];
}
