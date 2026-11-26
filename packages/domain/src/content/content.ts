import type {
  ContentClient,
  ContentFaq,
  ContentService,
  ContentTestimonial,
  SiteContent,
} from '@rs/shared';

export type { ContentClient, ContentFaq, ContentService, ContentTestimonial, SiteContent };

/** Demonstration content must always be flagged so it can never be mistaken for real data. */
export function assertDemonstrationContent(
  content: Pick<SiteContent, 'clients' | 'testimonials'>,
): void {
  const bad = [...content.clients, ...content.testimonials].find((c) => c.isDemonstration !== true);
  if (bad) throw new Error(`Content item ${bad.id} must be flagged isDemonstration`);
}
