import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_LOCATION } from '../location/pincodeLocation';
import {
  QuoteDraftContext,
  type QuoteDraft,
  type QuoteDraftContextValue,
} from './quoteDraftContext';

const EMPTY_DRAFT: QuoteDraft = {
  pickup: EMPTY_LOCATION,
  drop: EMPTY_LOCATION,
  moveType: '',
  vehicleType: '',
};

/** In-memory draft shared by the hero form and the route animation. Never persisted. */
export function QuoteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<QuoteDraft>(EMPTY_DRAFT);

  const patchPickup = useCallback(
    (patch: Partial<QuoteDraft['pickup']>) =>
      setDraft((d) => ({ ...d, pickup: { ...d.pickup, ...patch } })),
    [],
  );
  const patchDrop = useCallback(
    (patch: Partial<QuoteDraft['drop']>) =>
      setDraft((d) => ({ ...d, drop: { ...d.drop, ...patch } })),
    [],
  );
  const setMoveType = useCallback(
    (moveType: QuoteDraft['moveType']) => setDraft((d) => ({ ...d, moveType })),
    [],
  );
  const setVehicleType = useCallback(
    (vehicleType: QuoteDraft['vehicleType']) => setDraft((d) => ({ ...d, vehicleType })),
    [],
  );
  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo<QuoteDraftContextValue>(
    () => ({ draft, patchPickup, patchDrop, setMoveType, setVehicleType, resetDraft }),
    [draft, patchPickup, patchDrop, setMoveType, setVehicleType, resetDraft],
  );

  return <QuoteDraftContext.Provider value={value}>{children}</QuoteDraftContext.Provider>;
}
