import {
  MOVE_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  formatIndianMobile,
  normalizeInternationalNumber,
} from '@rs/shared';
import { formatIstTimestamp } from '../shared-kernel/time';
import type { Location } from '../location/location';
import type { QuoteRequest } from './quote-request';

const coords = (l: { latitude: number; longitude: number }) =>
  `${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}`;

const place = (label: string, l: Location): string[] => [
  `${label}: ${l.address}`,
  `${label} area coordinates (approximate): ${coords(l)}`,
];

/**
 * Builds the plain-text quote request sent to the business via WhatsApp. It never contains a
 * price: the owner prepares the quotation personally and replies in the same chat.
 * Coordinates are included on purpose (the customer is sharing them with the business) but
 * must never be logged or sent to analytics.
 */
export function buildQuoteWhatsAppMessage(quote: QuoteRequest, businessName: string): string {
  const lines = [
    `*${businessName} - Quote Request*`,
    `Reference: ${quote.referenceNumber}`,
    `Name: ${quote.customerName}`,
    `Mobile: ${formatIndianMobile(quote.mobile)}`,
    `Move type: ${MOVE_TYPE_LABELS[quote.moveType]}`,
    `Vehicle: ${VEHICLE_TYPE_LABELS[quote.vehicleType]}`,
    ...place('Pickup', quote.pickup),
    ...place('Drop', quote.drop),
    `Approximate distance: ${quote.distanceKm} km`,
    `Pickup date: ${quote.pickupDate}`,
    `Notes: ${quote.notes ?? '-'}`,
    `Source: ${quote.sourcePage}`,
    `Sent: ${formatIstTimestamp(quote.createdAt)}`,
  ];
  return lines.join('\n');
}

/** `https://wa.me/<digits>?text=<url-encoded message>`; returns null for an invalid number. */
export function buildWhatsAppUrl(whatsappNumber: string, message: string): string | null {
  const digits = normalizeInternationalNumber(whatsappNumber);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
