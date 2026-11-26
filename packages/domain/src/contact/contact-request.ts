import type { ContactMethod, ContactStatus } from '@rs/shared';

export interface ContactRequest {
  requestId: string;
  createdAt: Date;
  name: string;
  /** Normalised `91XXXXXXXXXX`. */
  mobile: string;
  email?: string | undefined;
  subject: string;
  message: string;
  preferredContactMethod: ContactMethod;
  consentReference: string;
  status: ContactStatus;
  sourcePage: string;
}

export function createContactRequest(props: Omit<ContactRequest, 'status'>): ContactRequest {
  return { ...props, status: 'NEW' };
}
