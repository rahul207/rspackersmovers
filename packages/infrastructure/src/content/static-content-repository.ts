import type { ContentRepository } from '@rs/application';
import type { SiteContent } from '@rs/shared';

/**
 * DEMONSTRATION CONTENT - FICTIONAL.
 * The clients and testimonials below are invented placeholders used to show the layout.
 * They are not real customers, do not use real company logos and must be replaced with
 * verified, permission-cleared content before production.
 */
export const SEED_CONTENT: SiteContent = {
  services: [
    {
      id: 'household',
      title: 'Household shifting',
      icon: 'home',
      description: 'Careful packing, loading, transport and unloading for homes and apartments.',
    },
    {
      id: 'office',
      title: 'Office relocation',
      icon: 'building',
      description: 'Planned moves for workstations, files and equipment with minimal downtime.',
    },
    {
      id: 'local',
      title: 'Local moving',
      icon: 'map-pin',
      description: 'Same-city moves with a vehicle sized to your load.',
    },
    {
      id: 'intercity',
      title: 'Intercity moving',
      icon: 'route',
      description: 'Long-distance and interstate moves with route planning and status updates.',
    },
    {
      id: 'packing',
      title: 'Packing and unpacking',
      icon: 'package',
      description: 'Packing materials and trained helpers for fragile and bulky items.',
    },
    {
      id: 'vehicle',
      title: 'Vehicle transportation',
      icon: 'car',
      description: 'Transport for two-wheelers and cars between cities.',
    },
    {
      id: 'warehousing',
      title: 'Warehousing and storage',
      icon: 'warehouse',
      description: 'Short-term storage between moves. Availability depends on location.',
    },
    {
      id: 'courier',
      title: 'Courier and parcel services',
      icon: 'send',
      description: 'Door-to-door parcel delivery for individuals and small businesses.',
    },
    {
      id: 'commercial',
      title: 'Commercial goods transportation',
      icon: 'truck',
      description: 'Transport of stock and goods using pickup, 14/17/20-foot and container trucks.',
    },
  ],
  faqs: [
    {
      id: 'estimate',
      question: 'How do I get a price?',
      answer:
        'Send your request through the quote form. It opens WhatsApp with your details pre-filled, and our team replies there with a quotation after reviewing your requirements. We do not show automatic prices on the website.',
    },
    {
      id: 'final',
      question: 'Is the quotation final?',
      answer:
        'Our team confirms the quotation with you on WhatsApp after reviewing your requirements, and large moves may need a survey before the final amount is agreed.',
    },
    {
      id: 'packing',
      question: 'Do you provide packing materials?',
      answer:
        'Packing and unpacking can be added to your request. Materials and charges are confirmed in your quotation.',
    },
    {
      id: 'insurance',
      question: 'Is my load insured?',
      answer:
        'Transit insurance can be arranged on request. Coverage terms and exclusions are shared with your quotation, so please read them before confirming.',
    },
    {
      id: 'cancellation',
      question: 'What is the cancellation policy?',
      answer:
        'Cancellation terms are set out in the cancellation policy and your confirmed quotation. Please contact us as early as possible if your plans change.',
    },
    {
      id: 'interstate',
      question: 'Do you handle interstate movement?',
      answer:
        'Yes. Interstate moves may need extra documentation and planning. Share your pickup and drop details and our team will confirm how we can help.',
    },
    {
      id: 'loading',
      question: 'Is loading and unloading included?',
      answer:
        'Helpers for loading and unloading can be added to your request. Tell us about floors, lifts and narrow access so we can plan the right team.',
    },
    {
      id: 'prohibited',
      question: 'Which goods cannot be transported?',
      answer:
        'Hazardous, illegal, perishable and flammable goods, cash, jewellery and other high-value valuables are generally not accepted. Ask us if you are unsure about a specific item.',
    },
    {
      id: 'payment',
      question: 'Which payment methods are accepted?',
      answer: 'Accepted payment methods and any advance amount are confirmed in your quotation.',
    },
    {
      id: 'timelines',
      question: 'How long does delivery take?',
      answer:
        'Timelines depend on distance, route, load and the pickup date. The operations team shares an expected timeline when they confirm your quotation.',
    },
  ],
  clients: [
    'NorthStar Retail',
    'GreenLeaf Interiors',
    'BluePeak Technologies',
    'UrbanNest Homes',
    'Sunrise Traders',
    'MetroCare Clinics',
    'Ivory Workspace',
    'Horizon Foods',
  ].map((name, i) => ({
    id: `demo-client-${i + 1}`,
    name,
    monogram: name
      .split(' ')
      .map((w) => w[0])
      .join(''),
    isDemonstration: true as const,
  })),
  testimonials: [
    {
      id: 'demo-t-1',
      quote:
        'The team confirmed every detail with us on WhatsApp before we agreed. Our flat shifting went smoothly.',
      author: 'Demo Reviewer A',
      role: 'Household move (fictional)',
      rating: 5,
    },
    {
      id: 'demo-t-2',
      quote: 'Our office move was planned around the weekend so we lost no working hours.',
      author: 'Demo Reviewer B',
      role: 'Office relocation (fictional)',
      rating: 5,
    },
    {
      id: 'demo-t-3',
      quote:
        'Quick replies on WhatsApp and a clear quotation once they had understood what we needed moved.',
      author: 'Demo Reviewer C',
      role: 'Intercity move (fictional)',
      rating: 4,
    },
    {
      id: 'demo-t-4',
      quote: 'Packing was careful and the fragile items arrived intact.',
      author: 'Demo Reviewer D',
      role: 'Packing service (fictional)',
      rating: 5,
    },
    {
      id: 'demo-t-5',
      quote: 'Handy for sending small parcels across the city without long forms.',
      author: 'Demo Reviewer E',
      role: 'Courier (fictional)',
      rating: 4,
    },
  ].map((t) => ({ ...t, isDemonstration: true as const })),
};

export class StaticContentRepository implements ContentRepository {
  get(): Promise<SiteContent> {
    return Promise.resolve(SEED_CONTENT);
  }
}
