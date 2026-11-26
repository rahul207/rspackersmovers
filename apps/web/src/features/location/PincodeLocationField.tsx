import { useEffect, useState } from 'react';
import type { PincodeLookup, PostOfficeEntry, ResolvedArea } from '@rs/shared';
import { ApiError, apiGet, errorMessage } from '../../lib/apiClient';
import { FieldLabel } from '../../ui/FieldLabel';
import { FieldError } from '../../ui/FormParts';
import {
  CLEARED_AREA,
  LOCATION_LABELS,
  PINCODE_LENGTH,
  areaLookupPath,
  isAreaResolved,
  isValidPincode,
  locationControlIds,
  officeOptionLabel,
  officesFoundMessage,
  sanitizePincode,
  type LocationDraft,
  type LocationErrors,
} from './pincodeLocation';

interface PincodeLocationFieldProps {
  /** Id prefix of the controls, e.g. `quote-pickup`. */
  id: string;
  /** `Pickup` or `Drop`; used for the group title and the control labels. */
  title: 'Pickup' | 'Drop';
  value: LocationDraft;
  /** Receives a partial update so asynchronous results never overwrite newer typing. */
  onChange: (patch: Partial<LocationDraft>) => void;
  errors?: LocationErrors;
}

type LookupResult =
  | { key: string; status: 'done'; offices: PostOfficeEntry[] }
  | { key: string; status: 'error'; message: string };

type ResolveFailure = { key: string; message: string };

const NO_OFFICE_MESSAGE = 'No post office found for this PIN code. Please check the number.';
const APPROXIMATE_NOTE =
  'We found the PIN code or district centre. Our team will confirm the exact spot from your address.';

/**
 * Three-step location input: PIN code -> post office (area) chosen from India Post's list ->
 * full address typed by hand. Coordinates are resolved from the chosen area on the server.
 */
export function PincodeLocationField({
  id,
  title,
  value,
  onChange,
  errors = {},
}: PincodeLocationFieldProps) {
  const ids = locationControlIds(id);
  const [lookupRetry, setLookupRetry] = useState(0);
  const [resolveRetry, setResolveRetry] = useState(0);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [resolveFailure, setResolveFailure] = useState<ResolveFailure | null>(null);

  const { pincode, officeId } = value;
  const pinReady = isValidPincode(pincode);
  const lookupKey = `${pincode}:${lookupRetry}`;
  const settled = pinReady && lookup?.key === lookupKey ? lookup : null;
  const offices = settled?.status === 'done' ? settled.offices : [];
  const lookupState = !pinReady ? 'idle' : settled ? settled.status : 'loading';

  useEffect(() => {
    if (!isValidPincode(pincode)) return undefined;
    const controller = new AbortController();
    const key = `${pincode}:${lookupRetry}`;
    apiGet<PincodeLookup>(`/locations/pincode/${pincode}`, { signal: controller.signal }).then(
      (result) => setLookup({ key, status: 'done', offices: result.offices }),
      (error: unknown) => {
        if (error instanceof ApiError && error.isAborted) return;
        setLookup({ key, status: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [pincode, lookupRetry]);

  const selected = offices.find((office) => office.id === officeId);
  const resolved = isAreaResolved(value);
  const resolveKey = `${officeId}:${resolveRetry}`;
  const resolveState =
    !selected || resolved ? 'idle' : resolveFailure?.key === resolveKey ? 'error' : 'loading';

  useEffect(() => {
    if (!selected || resolved) return undefined;
    const controller = new AbortController();
    const key = `${selected.id}:${resolveRetry}`;
    apiGet<ResolvedArea>(areaLookupPath(selected), { signal: controller.signal }).then(
      (area) => {
        setResolveFailure(null);
        onChange({
          latitude: area.latitude,
          longitude: area.longitude,
          areaLabel: area.areaLabel,
          confidence: area.confidence,
        });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.isAborted) return;
        setResolveFailure({ key, message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [selected, resolved, resolveRetry, onChange]);

  const handlePincode = (raw: string) => {
    const next = sanitizePincode(raw);
    if (next !== pincode) onChange({ pincode: next, ...CLEARED_AREA });
  };

  const handleArea = (nextId: string) => {
    const office = offices.find((o) => o.id === nextId);
    setResolveRetry((n) => n + 1);
    if (!office) {
      onChange({ ...CLEARED_AREA });
      return;
    }
    onChange({
      ...CLEARED_AREA,
      officeId: office.id,
      area: office.name,
      district: office.district,
      state: office.state,
    });
  };

  let status = '';
  let retry: (() => void) | null = null;
  if (selected) {
    if (resolveState === 'loading') status = `Finding the location of ${selected.name}…`;
    else if (resolveState === 'error' && resolveFailure) {
      status = resolveFailure.message;
      retry = () => setResolveRetry((n) => n + 1);
    }
  } else if (settled?.status === 'error') {
    status = settled.message;
    retry = () => setLookupRetry((n) => n + 1);
  } else if (lookupState === 'loading') status = 'Looking up post offices…';
  else if (settled?.status === 'done') {
    status = offices.length > 0 ? officesFoundMessage(offices.length) : NO_OFFICE_MESSAGE;
  }
  const failed = retry !== null;

  const describe = (...parts: (string | undefined)[]) =>
    parts.filter(Boolean).join(' ') || undefined;
  const statusId = `${id}-status`;

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-1 text-base font-bold text-navy-900">{title} location</legend>

      <div>
        <FieldLabel htmlFor={ids.pincode} required>
          {title} {LOCATION_LABELS.pincode}
        </FieldLabel>
        <input
          id={ids.pincode}
          type="text"
          inputMode="numeric"
          maxLength={PINCODE_LENGTH}
          autoComplete="off"
          className="input"
          value={pincode}
          aria-required="true"
          aria-invalid={errors.pincode ? true : undefined}
          aria-describedby={describe(
            `${id}-pincode-hint`,
            statusId,
            errors.pincode ? `${id}-pincode-error` : undefined,
          )}
          onChange={(event) => handlePincode(event.target.value)}
        />
        <p id={`${id}-pincode-hint`} className="field-hint">
          6-digit PIN code of the {title.toLowerCase()} address
        </p>
        <FieldError id={`${id}-pincode-error`} message={errors.pincode} />
      </div>

      <div
        role="status"
        aria-live="polite"
        id={statusId}
        className={`text-sm ${failed ? 'font-medium text-red-700' : 'text-slate-700'}`}
      >
        {status}
      </div>
      {retry ? (
        <button type="button" className="btn-outline min-h-11 px-4 py-2 text-sm" onClick={retry}>
          Try again
        </button>
      ) : null}

      <div>
        <FieldLabel htmlFor={ids.area} required>
          {title} {LOCATION_LABELS.area}
        </FieldLabel>
        <select
          id={ids.area}
          className="input"
          value={selected ? selected.id : ''}
          aria-required="true"
          aria-invalid={errors.area ? true : undefined}
          aria-describedby={describe(errors.area ? `${id}-area-error` : undefined)}
          onChange={(event) => handleArea(event.target.value)}
        >
          <option value="">Select your area</option>
          {offices.map((office) => (
            <option key={office.id} value={office.id}>
              {officeOptionLabel(office)}
            </option>
          ))}
        </select>
        <FieldError id={`${id}-area-error`} message={errors.area} />
        {resolved ? (
          <div className="mt-2 text-sm text-slate-800">
            <p>
              <span className="font-semibold">Area: </span>
              {value.areaLabel}
            </p>
            {value.confidence === 'approximate' ? (
              <p className="mt-1 text-slate-700">{APPROXIMATE_NOTE}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor={ids.streetAddress} required>
          {title} {LOCATION_LABELS.streetAddress}
        </FieldLabel>
        <textarea
          id={ids.streetAddress}
          rows={3}
          maxLength={250}
          autoComplete="off"
          className="input"
          value={value.streetAddress}
          aria-required="true"
          aria-invalid={errors.streetAddress ? true : undefined}
          aria-describedby={describe(
            `${id}-address-hint`,
            errors.streetAddress ? `${id}-address-error` : undefined,
          )}
          onChange={(event) => onChange({ streetAddress: event.target.value })}
        />
        <p id={`${id}-address-hint`} className="field-hint">
          House or flat number, building, street and nearest landmark
        </p>
        <FieldError id={`${id}-address-error`} message={errors.streetAddress} />
      </div>
    </fieldset>
  );
}
