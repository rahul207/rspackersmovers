import { useEffect, type ReactNode, type RefObject } from 'react';
import { AlertIcon } from './Icons';

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <AlertIcon size={18} className="mt-0.5 shrink-0" />
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-xs font-medium text-slate-700">
      (required)
    </span>
  );
}

export interface ErrorSummaryItem {
  /** DOM id of the control to focus. */
  controlId: string;
  label: string;
  message: string;
}

interface ErrorSummaryProps {
  summaryRef: RefObject<HTMLDivElement | null>;
  items: ErrorSummaryItem[];
  general?: string | undefined;
}

/** Focus target announced on a failed submit. */
export function ErrorSummary({ summaryRef, items, general }: ErrorSummaryProps) {
  if (items.length === 0 && !general) return null;
  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      className="rounded-xl border-2 border-red-700 bg-red-50 p-4 text-red-900"
    >
      <p className="flex items-center gap-2 font-bold">
        <AlertIcon size={20} />
        {items.length > 0
          ? 'Please fix the following before sending:'
          : 'We could not send your request'}
      </p>
      {general ? <p className="mt-1.5 text-sm font-medium">{general}</p> : null}
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
          {items.map((item) => (
            <li key={item.controlId}>
              <a
                href={`#${item.controlId}`}
                className="font-semibold underline"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(item.controlId)?.focus();
                }}
              >
                {item.label}
              </a>
              : {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Moves focus to the summary after the render triggered by a failed submit. */
export function useFocusOnToken(ref: RefObject<HTMLElement | null>, token: number): void {
  useEffect(() => {
    if (token === 0) return undefined;
    const frame = window.requestAnimationFrame(() => ref.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [ref, token]);
}

export function LiveRegion({ children }: { children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
