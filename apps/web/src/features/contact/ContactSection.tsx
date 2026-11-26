import { useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import {
  CONTACT_METHODS,
  CONTACT_METHOD_LABELS,
  contactRequestSchema,
  type ContactCreated,
  type ContactMethod,
  type ContactRequestInput,
} from '@rs/shared';
import { ApiError, apiPost, errorMessage, mapFieldErrors } from '../../lib/apiClient';
import { splitPhones, telHref } from '../../lib/format';
import { createSchemaResolver } from '../../lib/schemaResolver';
import { DEFAULT_WHATSAPP_GREETING, buildWhatsappUrl } from '../../lib/whatsapp';
import { AppLink } from '../../ui/AppLink';
import { FieldLabel } from '../../ui/FieldLabel';
import {
  ErrorSummary,
  FieldError,
  LiveRegion,
  Spinner,
  useFocusOnToken,
  type ErrorSummaryItem,
} from '../../ui/FormParts';
import { CheckIcon } from '../../ui/Icons';
import { SectionHeading } from '../../ui/SectionHeading';
import { TurnstileWidget } from '../../ui/TurnstileWidget';
import { useSiteConfig } from '../site/siteConfigContext';

interface ContactFormValues {
  name: string;
  mobile: string;
  email: string;
  subject: string;
  message: string;
  preferredContactMethod: ContactMethod | '';
  consent: boolean;
  website: string;
}
type ContactField = keyof ContactFormValues;

const FIELD_NAMES: readonly ContactField[] = [
  'name',
  'mobile',
  'email',
  'subject',
  'message',
  'preferredContactMethod',
  'consent',
  'website',
];

const DEFAULTS: ContactFormValues = {
  name: '',
  mobile: '',
  email: '',
  subject: '',
  message: '',
  preferredContactMethod: 'PHONE_CALL',
  consent: false,
  website: '',
};

const CONTROLS: Partial<Record<ContactField, { id: string; label: string }>> = {
  name: { id: 'contact-name', label: 'Name' },
  mobile: { id: 'contact-mobile', label: 'Mobile number' },
  email: { id: 'contact-email', label: 'Email' },
  subject: { id: 'contact-subject', label: 'Subject' },
  message: { id: 'contact-message', label: 'Message' },
  preferredContactMethod: { id: 'contact-method', label: 'Preferred contact method' },
  consent: { id: 'contact-consent', label: 'Consent to respond to your enquiry' },
};

function toPayload(
  values: ContactFormValues,
  extra: { sourcePage?: string; captchaToken?: string | undefined } = {},
): ContactRequestInput {
  const payload: Record<string, unknown> = {
    name: values.name,
    mobile: values.mobile,
    subject: values.subject,
    message: values.message,
    preferredContactMethod: values.preferredContactMethod,
    consent: values.consent,
    website: values.website,
    sourcePage: extra.sourcePage ?? '/',
  };
  if (values.email.trim()) payload.email = values.email;
  if (extra.captchaToken) payload.captchaToken = extra.captchaToken;
  return payload as unknown as ContactRequestInput;
}

const resolver = createSchemaResolver<ContactFormValues>(contactRequestSchema, {
  toPayload: (values) => toPayload(values),
  messages: (field, message, values) => {
    switch (field) {
      case 'name':
        return values.name.trim() ? message : 'Enter your name';
      case 'mobile':
        return values.mobile.trim() ? message : 'Enter your mobile number';
      case 'subject':
        return values.subject.trim() ? message : 'Enter a subject';
      case 'message':
        return values.message.trim() ? message : 'Enter your message';
      default:
        return message;
    }
  },
});

function summaryItems(errors: FieldErrors<ContactFormValues>): ErrorSummaryItem[] {
  const items: ErrorSummaryItem[] = [];
  for (const field of FIELD_NAMES) {
    const control = CONTROLS[field];
    const message = errors[field]?.message;
    if (control && typeof message === 'string')
      items.push({ controlId: control.id, label: control.label, message });
  }
  return items;
}

export default function ContactSection() {
  const config = useSiteConfig();
  const { pathname } = useLocation();
  const { register, handleSubmit, setError, formState } = useForm<ContactFormValues>({
    defaultValues: DEFAULTS,
    resolver,
    shouldFocusError: false,
    reValidateMode: 'onChange',
  });
  const { errors } = formState;

  const [created, setCreated] = useState<ContactCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [general, setGeneral] = useState<string | undefined>();
  const [summaryToken, setSummaryToken] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaReset, setCaptchaReset] = useState(0);
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  useFocusOnToken(summaryRef, summaryToken);
  useFocusOnToken(successRef, created ? 1 : 0);

  const captchaSiteKey =
    config.captcha.provider === 'turnstile' && config.captcha.siteKey
      ? config.captcha.siteKey
      : undefined;

  const fail = (message?: string) => {
    setGeneral(message);
    setSummaryToken((n) => n + 1);
  };

  const onValid = async (values: ContactFormValues) => {
    if (inFlight.current) return;
    if (captchaSiteKey && !captchaToken) {
      fail('Please complete the verification challenge below, then send your message again.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setGeneral(undefined);
    try {
      const result = await apiPost<ContactCreated>(
        '/contact-requests',
        toPayload(values, { sourcePage: pathname, captchaToken }),
      );
      setCreated(result);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const mapped = mapFieldErrors(error.fieldErrors, FIELD_NAMES);
        for (const [field, message] of Object.entries(mapped.fields)) {
          setError(field as ContactField, { type: 'server', message });
        }
        fail(mapped.unmapped[0] ?? 'Some details need your attention.');
      } else {
        fail(errorMessage(error));
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      setCaptchaToken(undefined);
      setCaptchaReset((n) => n + 1);
    }
  };

  const describe = (field: ContactField, extra?: string) =>
    [extra, errors[field] ? `contact-${field}-error` : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="bg-navy-50">
      <div className="container-page py-16 sm:py-20">
        <SectionHeading
          id="contact-title"
          eyebrow="Contact"
          title="Send us a message"
          lead="Have a question that is not covered here? Tell us how to reach you and we will get back to you."
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {created ? (
            <div
              ref={successRef}
              role="status"
              tabIndex={-1}
              className="card self-start border-2 border-navy-900 p-6 sm:p-8"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
                  <CheckIcon size={20} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold">Message sent</h3>
                  <p className="mt-1 text-slate-700">
                    Thank you. Your request reference is{' '}
                    <strong className="text-navy-900 select-all">{created.requestId}</strong>. Our
                    team will contact you using your preferred method.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form
              noValidate
              aria-labelledby="contact-form-title"
              onSubmit={(event) => {
                void handleSubmit(onValid, () => fail())(event);
              }}
              className="card space-y-4 p-5 sm:p-7"
            >
              <h3 id="contact-form-title" className="text-xl font-bold">
                Contact form
              </h3>
              <p className="text-sm text-slate-700">
                Fields marked <span className="font-semibold">(required)</span> must be completed.
              </p>
              <ErrorSummary
                summaryRef={summaryRef}
                items={summaryItems(errors)}
                general={general}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="contact-name" required>
                    Name
                  </FieldLabel>
                  <input
                    id="contact-name"
                    type="text"
                    autoComplete="name"
                    className="input"
                    aria-required="true"
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={describe('name')}
                    {...register('name')}
                  />
                  <FieldError id="contact-name-error" message={errors.name?.message} />
                </div>
                <div>
                  <FieldLabel htmlFor="contact-mobile" required>
                    Mobile number
                  </FieldLabel>
                  <input
                    id="contact-mobile"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="input"
                    aria-required="true"
                    aria-invalid={errors.mobile ? true : undefined}
                    aria-describedby={describe('mobile')}
                    {...register('mobile')}
                  />
                  <FieldError id="contact-mobile-error" message={errors.mobile?.message} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="contact-email">Email (optional)</FieldLabel>
                <input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describe('email', 'contact-email-hint')}
                  {...register('email')}
                />
                <p id="contact-email-hint" className="field-hint">
                  Needed only if you choose to be contacted by email.
                </p>
                <FieldError id="contact-email-error" message={errors.email?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="contact-subject" required>
                  Subject
                </FieldLabel>
                <input
                  id="contact-subject"
                  type="text"
                  className="input"
                  aria-required="true"
                  aria-invalid={errors.subject ? true : undefined}
                  aria-describedby={describe('subject')}
                  {...register('subject')}
                />
                <FieldError id="contact-subject-error" message={errors.subject?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="contact-message" required>
                  Message
                </FieldLabel>
                <textarea
                  id="contact-message"
                  rows={5}
                  maxLength={2000}
                  className="input"
                  aria-required="true"
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={describe('message')}
                  {...register('message')}
                />
                <FieldError id="contact-message-error" message={errors.message?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="contact-method" required>
                  Preferred contact method
                </FieldLabel>
                <select
                  id="contact-method"
                  className="input"
                  aria-required="true"
                  aria-invalid={errors.preferredContactMethod ? true : undefined}
                  aria-describedby={describe('preferredContactMethod')}
                  {...register('preferredContactMethod')}
                >
                  {CONTACT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {CONTACT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="contact-preferredContactMethod-error"
                  message={errors.preferredContactMethod?.message}
                />
              </div>

              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '-10000px',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                }}
              >
                <label htmlFor="contact-website">Leave this field empty</label>
                <input
                  id="contact-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  {...register('website')}
                />
              </div>

              <div>
                <div className="flex items-start gap-3">
                  <input
                    id="contact-consent"
                    type="checkbox"
                    className="mt-0.5 h-6 w-6 shrink-0 rounded accent-navy-900"
                    aria-required="true"
                    aria-invalid={errors.consent ? true : undefined}
                    aria-describedby={describe('consent')}
                    {...register('consent')}
                  />
                  <label htmlFor="contact-consent" className="text-sm font-medium">
                    I agree to RS Packers &amp; Movers using the details I submit to respond to my
                    enquiry.
                  </label>
                </div>
                <p className="mt-1 pl-9 text-xs text-slate-700">
                  See our{' '}
                  <AppLink href={config.policyLinks.privacy} className="font-semibold underline">
                    privacy policy
                  </AppLink>
                  .
                </p>
                <div className="pl-9">
                  <FieldError id="contact-consent-error" message={errors.consent?.message} />
                </div>
              </div>

              {captchaSiteKey ? (
                <TurnstileWidget
                  siteKey={captchaSiteKey}
                  onToken={setCaptchaToken}
                  resetKey={captchaReset}
                />
              ) : null}

              <button
                type="submit"
                className="btn-primary w-full sm:w-auto"
                disabled={submitting}
                aria-busy={submitting}
              >
                Send message
                {submitting ? <Spinner /> : null}
              </button>
              <LiveRegion>{submitting ? 'Sending your message…' : ''}</LiveRegion>
            </form>
          )}

          <aside aria-labelledby="contact-details-title" className="card self-start p-6">
            <h3 id="contact-details-title" className="text-xl font-bold">
              Other ways to reach us
            </h3>
            <ContactDetails />
          </aside>
        </div>
      </div>
    </div>
  );
}

function ContactDetails() {
  const { business } = useSiteConfig();
  const whatsappUrl = buildWhatsappUrl(business.whatsappNumber, DEFAULT_WHATSAPP_GREETING);
  const hasAny = business.phone || business.email || business.address || whatsappUrl;
  if (!hasAny) {
    return (
      <p className="mt-3 text-slate-700">Use the form and our team will reply to you directly.</p>
    );
  }
  return (
    <dl className="mt-3 space-y-3 text-slate-800">
      {whatsappUrl ? (
        <div>
          <dt className="text-sm font-semibold text-slate-700">WhatsApp</dt>
          <dd>
            <a
              className="font-semibold underline"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat with us on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </dd>
        </div>
      ) : null}
      {business.phone ? (
        <div>
          <dt className="text-sm font-semibold text-slate-700">Phone</dt>
          <dd className="flex flex-col">
            {splitPhones(business.phone).map((phone) => (
              <a key={phone} className="font-semibold underline" href={telHref(phone)}>
                {phone}
              </a>
            ))}
          </dd>
        </div>
      ) : null}
      {business.email ? (
        <div>
          <dt className="text-sm font-semibold text-slate-700">Email</dt>
          <dd>
            <a className="font-semibold break-all underline" href={`mailto:${business.email}`}>
              {business.email}
            </a>
          </dd>
        </div>
      ) : null}
      {business.address ? (
        <div>
          <dt className="text-sm font-semibold text-slate-700">Address</dt>
          <dd>{business.address}</dd>
        </div>
      ) : null}
    </dl>
  );
}
