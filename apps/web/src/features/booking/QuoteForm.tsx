import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import {
  MOVE_TYPES,
  MOVE_TYPE_LABELS,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  quoteRequestSchema,
  type MoveType,
  type QuoteCreated,
  type VehicleType,
} from '@rs/shared';
import { ApiError, apiPost, errorMessage, mapFieldErrors } from '../../lib/apiClient';
import { todayIso } from '../../lib/format';
import { createSchemaResolver } from '../../lib/schemaResolver';
import { isSafeWhatsappUrl } from '../../lib/whatsapp';
import { FieldLabel } from '../../ui/FieldLabel';
import {
  ErrorSummary,
  FieldError,
  LiveRegion,
  Spinner,
  useFocusOnToken,
  type ErrorSummaryItem,
} from '../../ui/FormParts';
import { TurnstileWidget } from '../../ui/TurnstileWidget';
import { AppLink } from '../../ui/AppLink';
import { PincodeLocationField } from '../location/PincodeLocationField';
import {
  LOCATION_LABELS,
  locationControlIds,
  locationErrors,
  type LocationErrors,
} from '../location/pincodeLocation';
import { useSiteConfig } from '../site/siteConfigContext';
import { QuoteConfirmation } from './QuoteConfirmation';
import { useQuoteDraft } from './quoteDraftContext';
import {
  QUOTE_DEFAULTS,
  QUOTE_FIELD_NAMES,
  buildQuotePayload,
  quoteExtraChecks,
  quoteMessage,
  type QuoteFieldName,
  type QuoteFormValues,
} from './quoteValidation';

const resolver = createSchemaResolver<QuoteFormValues>(quoteRequestSchema, {
  toPayload: (values) => buildQuotePayload(values),
  extra: (values) => quoteExtraChecks(values),
  messages: quoteMessage,
});

const CONTROLS: Partial<Record<QuoteFieldName, { id: string; label: string }>> = {
  pickupDate: { id: 'quote-date', label: 'Pickup date' },
  moveType: { id: 'quote-move-type', label: 'Move type' },
  vehicleType: { id: 'quote-vehicle-type', label: 'Vehicle type' },
  customerName: { id: 'quote-name', label: 'Your name' },
  mobile: { id: 'quote-mobile', label: 'Mobile number' },
  email: { id: 'quote-email', label: 'Email (optional)' },
  notes: { id: 'quote-notes', label: 'Notes (optional)' },
  consent: { id: 'quote-consent', label: 'Consent to prepare your quotation' },
};

type LocationKey = 'pickup' | 'drop';
const LOCATION_IDS: Record<LocationKey, string> = { pickup: 'quote-pickup', drop: 'quote-drop' };
const LOCATION_TITLES = { pickup: 'Pickup', drop: 'Drop' } as const;

function summaryItems(
  errors: FieldErrors<QuoteFormValues>,
  locations: Record<LocationKey, LocationErrors>,
): ErrorSummaryItem[] {
  const items: ErrorSummaryItem[] = [];
  for (const field of QUOTE_FIELD_NAMES) {
    if (field === 'pickup' || field === 'drop') {
      const ids = locationControlIds(LOCATION_IDS[field]);
      for (const part of ['pincode', 'area', 'streetAddress'] as const) {
        const message = locations[field][part];
        if (message) {
          items.push({
            controlId: ids[part],
            label: `${LOCATION_TITLES[field]} ${LOCATION_LABELS[part]}`,
            message,
          });
        }
      }
      continue;
    }
    const control = CONTROLS[field];
    const message = errors[field]?.message;
    if (control && typeof message === 'string') {
      items.push({ controlId: control.id, label: control.label, message });
    }
  }
  return items;
}

function Field({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function QuoteForm() {
  const config = useSiteConfig();
  const { pathname } = useLocation();
  const { draft, patchPickup, patchDrop, setMoveType, setVehicleType, resetDraft } =
    useQuoteDraft();

  const form = useForm<QuoteFormValues>({
    defaultValues: {
      ...QUOTE_DEFAULTS,
      pickup: draft.pickup,
      drop: draft.drop,
      moveType: draft.moveType,
      vehicleType: draft.vehicleType,
    },
    resolver,
    shouldFocusError: false,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { register, handleSubmit, setValue, setError, clearErrors, reset, formState } = form;
  const { errors, isSubmitted } = formState;

  const [result, setResult] = useState<QuoteCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [general, setGeneral] = useState<string | undefined>();
  const [summaryToken, setSummaryToken] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaReset, setCaptchaReset] = useState(0);
  const inFlight = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  useFocusOnToken(summaryRef, summaryToken);

  const captchaSiteKey =
    config.captcha.provider === 'turnstile' && config.captcha.siteKey
      ? config.captcha.siteKey
      : undefined;

  // Mirror the shared draft (also read by the route animation) into the form values.
  useEffect(() => {
    const opts = { shouldValidate: isSubmitted, shouldDirty: false } as const;
    setValue('pickup', draft.pickup, opts);
    setValue('drop', draft.drop, opts);
    setValue('moveType', draft.moveType, opts);
    setValue('vehicleType', draft.vehicleType, opts);
    // isSubmitted is read at the time the draft changes, not a trigger itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.pickup, draft.drop, draft.moveType, draft.vehicleType, setValue]);

  const fail = (message?: string) => {
    setGeneral(message);
    setSummaryToken((n) => n + 1);
  };

  const onValid = async (values: QuoteFormValues) => {
    if (inFlight.current) return;
    if (captchaSiteKey && !captchaToken) {
      fail('Please complete the verification challenge below, then send your request again.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setGeneral(undefined);
    try {
      const payload = buildQuotePayload(values, {
        sourcePage: pathname,
        captchaToken,
      });
      const created = await apiPost<QuoteCreated>('/quotes', payload);
      setResult(created);
      if (isSafeWhatsappUrl(created.whatsapp.url)) {
        window.open(created.whatsapp.url, '_blank', 'noopener');
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const mapped = mapFieldErrors(error.fieldErrors, QUOTE_FIELD_NAMES);
        for (const [field, message] of Object.entries(mapped.fields)) {
          setError(field as QuoteFieldName, { type: 'server', message });
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

  const startAgain = () => {
    setResult(null);
    setGeneral(undefined);
    reset(QUOTE_DEFAULTS);
    resetDraft();
  };

  if (result) return <QuoteConfirmation result={result} onReset={startAgain} />;

  const locationErrorsFor = (key: LocationKey): LocationErrors => {
    const message = errors[key]?.message;
    if (typeof message !== 'string') return {};
    const local = locationErrors(draft[key]);
    // A server-side rejection has no matching local error: show it beside the address.
    return Object.keys(local).length > 0 ? local : { streetAddress: message };
  };
  const locationFieldErrors = {
    pickup: locationErrorsFor('pickup'),
    drop: locationErrorsFor('drop'),
  };
  const items = summaryItems(errors, locationFieldErrors);
  const describe = (field: QuoteFieldName, extra?: string) =>
    [extra, errors[field] ? `quote-${field}-error` : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <form
      noValidate
      aria-labelledby="quote-form-title"
      onSubmit={(event) => {
        void handleSubmit(onValid, () => fail())(event);
      }}
      className="space-y-4"
    >
      <div>
        <h2 id="quote-form-title" className="text-2xl font-extrabold">
          Get your quote
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Fields marked <span className="font-semibold">(required)</span> must be completed. No
          payment is taken online.
        </p>
      </div>

      <ErrorSummary summaryRef={summaryRef} items={items} general={general} />

      <PincodeLocationField
        id="quote-pickup"
        title="Pickup"
        value={draft.pickup}
        onChange={patchPickup}
        errors={locationFieldErrors.pickup}
      />
      <PincodeLocationField
        id="quote-drop"
        title="Drop"
        value={draft.drop}
        onChange={patchDrop}
        errors={locationFieldErrors.drop}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="quote-date" required>
            Pickup date
          </FieldLabel>
          <input
            id="quote-date"
            type="date"
            min={todayIso()}
            className="input"
            aria-required="true"
            aria-invalid={errors.pickupDate ? true : undefined}
            aria-describedby={describe('pickupDate')}
            {...register('pickupDate')}
          />
          <FieldError id="quote-pickupDate-error" message={errors.pickupDate?.message} />
        </Field>

        <Field>
          <FieldLabel htmlFor="quote-move-type" required>
            Move type
          </FieldLabel>
          <select
            id="quote-move-type"
            className="input"
            value={draft.moveType}
            aria-required="true"
            aria-invalid={errors.moveType ? true : undefined}
            aria-describedby={describe('moveType')}
            onChange={(event) => {
              setMoveType(event.target.value as MoveType | '');
              clearErrors('moveType');
            }}
          >
            <option value="">Select a move type</option>
            {MOVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {MOVE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError id="quote-moveType-error" message={errors.moveType?.message} />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="quote-vehicle-type" required>
          Vehicle type
        </FieldLabel>
        <select
          id="quote-vehicle-type"
          className="input"
          value={draft.vehicleType}
          aria-required="true"
          aria-invalid={errors.vehicleType ? true : undefined}
          aria-describedby={describe('vehicleType')}
          onChange={(event) => {
            setVehicleType(event.target.value as VehicleType | '');
            clearErrors('vehicleType');
          }}
        >
          <option value="">Select a vehicle type</option>
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {VEHICLE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <FieldError id="quote-vehicleType-error" message={errors.vehicleType?.message} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="quote-name" required>
            Your name
          </FieldLabel>
          <input
            id="quote-name"
            type="text"
            autoComplete="name"
            className="input"
            aria-required="true"
            aria-invalid={errors.customerName ? true : undefined}
            aria-describedby={describe('customerName')}
            {...register('customerName')}
          />
          <FieldError id="quote-customerName-error" message={errors.customerName?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-mobile" required>
            Mobile number
          </FieldLabel>
          <input
            id="quote-mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="input"
            aria-required="true"
            aria-invalid={errors.mobile ? true : undefined}
            aria-describedby={describe('mobile', 'quote-mobile-hint')}
            {...register('mobile')}
          />
          <p id="quote-mobile-hint" className="field-hint">
            10-digit Indian mobile number
          </p>
          <FieldError id="quote-mobile-error" message={errors.mobile?.message} />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="quote-email">Email (optional)</FieldLabel>
        <input
          id="quote-email"
          type="email"
          autoComplete="email"
          className="input"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describe('email')}
          {...register('email')}
        />
        <FieldError id="quote-email-error" message={errors.email?.message} />
      </Field>

      <Field>
        <FieldLabel htmlFor="quote-notes">Notes (optional)</FieldLabel>
        <textarea
          id="quote-notes"
          rows={3}
          maxLength={1000}
          className="input"
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describe('notes')}
          {...register('notes')}
        />
        <FieldError id="quote-notes-error" message={errors.notes?.message} />
      </Field>

      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="quote-website">Leave this field empty</label>
        <input
          id="quote-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="quote-consent"
            type="checkbox"
            className="mt-0.5 h-6 w-6 shrink-0 rounded accent-navy-900"
            aria-required="true"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describe('consent')}
            {...register('consent')}
          />
          <label htmlFor="quote-consent" className="text-sm font-medium">
            I agree to RS Packers &amp; Movers using the details I submit to prepare my quotation.
          </label>
        </div>
        <p className="mt-1 pl-9 text-xs text-slate-700">
          This is separate from cookie and marketing choices. See our{' '}
          <AppLink href={config.policyLinks.privacy} className="font-semibold underline">
            privacy policy
          </AppLink>
          .
        </p>
        <div className="pl-9">
          <FieldError id="quote-consent-error" message={errors.consent?.message} />
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
        className="btn-primary w-full"
        disabled={submitting}
        aria-busy={submitting}
      >
        Get quote on WhatsApp
        {submitting ? <Spinner /> : null}
      </button>
      <LiveRegion>{submitting ? 'Sending your request…' : ''}</LiveRegion>
    </form>
  );
}
