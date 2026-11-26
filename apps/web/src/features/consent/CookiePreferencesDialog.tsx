import { useEffect, useId, useRef, useState } from 'react';
import { useSiteConfig } from '../site/siteConfigContext';
import { AppLink } from '../../ui/AppLink';
import { CloseIcon } from '../../ui/Icons';
import { useConsent } from './consentContext';
import type { ConsentChoices } from './consentStorage';

const NONE: ConsentChoices = { analytics: false, marketing: false, location: false };

interface SwitchRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: SwitchRowProps) {
  return (
    <li className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-base font-semibold">
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-slate-700">
          {description}
        </p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch mt-0.5"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-desc`}
        onChange={(event) => onChange?.(event.target.checked)}
      />
    </li>
  );
}

export function CookiePreferencesDialog() {
  const { decision, preferencesOpen, closePreferences, saveChoices } = useConsent();
  const { policyLinks } = useSiteConfig();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const [choices, setChoices] = useState<ConsentChoices>(NONE);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (preferencesOpen && !dialog.open) {
      setChoices(
        decision
          ? {
              analytics: decision.analytics,
              marketing: decision.marketing,
              location: decision.location,
            }
          : NONE,
      );
      dialog.showModal();
    } else if (!preferencesOpen && dialog.open) {
      dialog.close();
    }
    // Only react to open/close; the decision is read at the moment of opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferencesOpen]);

  const titleId = `${baseId}-title`;
  const set = (key: keyof ConsentChoices) => (value: boolean) =>
    setChoices((current) => ({ ...current, [key]: value }));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={closePreferences}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-navy-100 bg-white p-0 text-navy-900 shadow-2xl backdrop:bg-navy-950/60"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          saveChoices(choices);
        }}
        className="max-h-[90vh] overflow-y-auto p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-extrabold">
            Cookie settings
          </h2>
          <button
            type="button"
            className="-mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-navy-50"
            onClick={closePreferences}
          >
            <CloseIcon />
            <span className="sr-only">Close cookie settings</span>
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          Choose which optional processing you allow. You can change or withdraw your choices at any
          time from “Cookie settings” in the footer. Quotation and contact requests have their own
          separate consent.
        </p>

        <ul className="mt-3 divide-y divide-navy-100">
          <SwitchRow
            id={`${baseId}-necessary`}
            label="Strictly necessary"
            description="Needed for security, form protection and remembering your privacy choice. Always on."
            checked
            disabled
          />
          <SwitchRow
            id={`${baseId}-analytics`}
            label="Analytics"
            description="Anonymous page-view statistics that help us improve the site. No precise location is stored."
            checked={choices.analytics}
            onChange={set('analytics')}
          />
          <SwitchRow
            id={`${baseId}-marketing`}
            label="Marketing"
            description="Would allow advertising or remarketing tags. None are currently used on this site."
            checked={choices.marketing}
            onChange={set('marketing')}
          />
          <SwitchRow
            id={`${baseId}-location`}
            label="Location-related processing"
            description="Reserved for optional location-related features. Entering a PIN code to request a quote does not depend on this choice."
            checked={choices.location}
            onChange={set('location')}
          />
        </ul>

        <p className="mt-2 text-sm">
          <AppLink
            href={policyLinks.cookies}
            className="font-semibold text-navy-700 underline"
            onClick={closePreferences}
          >
            Cookie policy
          </AppLink>
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-outline" onClick={closePreferences}>
            Cancel
          </button>
          <button type="submit" className="btn-navy">
            Save preferences
          </button>
        </div>
      </form>
    </dialog>
  );
}
