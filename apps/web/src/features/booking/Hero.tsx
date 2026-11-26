import { useMemo } from 'react';
import type { VehicleType } from '@rs/shared';
import { CheckIcon } from '../../ui/Icons';
import { RouteAnimation } from '../animation/RouteAnimation';
import { toRouteLocation } from '../location/pincodeLocation';
import { QuoteForm } from './QuoteForm';
import { useQuoteDraft } from './quoteDraftContext';

const TRUST_POINTS = [
  'Quotation confirmed personally',
  'Request via WhatsApp',
  'No payment online',
  'Trained helpers on request',
];

export function Hero() {
  const { draft } = useQuoteDraft();
  const vehicle: VehicleType | undefined = draft.vehicleType === '' ? undefined : draft.vehicleType;
  const pickup = useMemo(() => toRouteLocation(draft.pickup), [draft.pickup]);
  const drop = useMemo(() => toRouteLocation(draft.drop), [draft.drop]);

  return (
    <section
      id="home"
      tabIndex={-1}
      aria-labelledby="hero-title"
      className="bg-gradient-to-b from-navy-50 to-white pt-8 pb-12 sm:pt-12 lg:pb-20"
    >
      <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <div className="order-1">
          <p className="eyebrow">Packing, moving &amp; courier</p>
          <h1
            id="hero-title"
            className="mt-3 text-4xl leading-tight font-extrabold tracking-tight text-navy-900 sm:text-5xl"
          >
            Move homes, offices and goods with a quotation you can trust
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-700">
            Tell us where you are moving from and to, then send your request to our team on
            WhatsApp. We confirm your quotation personally.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5 font-semibold text-navy-900">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
                  <CheckIcon size={16} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div
          id="quote-form-card"
          className="card order-2 self-start p-5 sm:p-7 lg:order-2 lg:row-span-2 lg:col-start-2 lg:row-start-1"
        >
          <QuoteForm />
        </div>

        <div className="order-3 aspect-[4/3] w-full lg:col-start-1 lg:row-start-2 lg:self-start">
          <RouteAnimation
            pickup={pickup}
            drop={drop}
            {...(vehicle ? { vehicleType: vehicle } : {})}
          />
        </div>
      </div>
    </section>
  );
}
