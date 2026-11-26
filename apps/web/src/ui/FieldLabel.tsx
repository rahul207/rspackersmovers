import type { ReactNode } from 'react';
import { RequiredMark } from './FormParts';

interface FieldLabelProps {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}

/** The required marker sits outside the <label> so the control's accessible name stays exact. */
export function FieldLabel({ htmlFor, required = false, children }: FieldLabelProps) {
  return (
    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-navy-900">
        {children}
      </label>
      {required ? <RequiredMark /> : null}
    </div>
  );
}
