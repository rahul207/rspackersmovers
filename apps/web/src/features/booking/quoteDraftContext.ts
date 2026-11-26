import { createContext, useContext } from 'react';
import type { MoveType, VehicleType } from '@rs/shared';
import type { LocationDraft } from '../location/pincodeLocation';

export interface QuoteDraft {
  pickup: LocationDraft;
  drop: LocationDraft;
  moveType: MoveType | '';
  vehicleType: VehicleType | '';
}

export interface QuoteDraftContextValue {
  draft: QuoteDraft;
  patchPickup: (patch: Partial<LocationDraft>) => void;
  patchDrop: (patch: Partial<LocationDraft>) => void;
  setMoveType: (value: MoveType | '') => void;
  setVehicleType: (value: VehicleType | '') => void;
  resetDraft: () => void;
}

export const QuoteDraftContext = createContext<QuoteDraftContextValue | null>(null);

export function useQuoteDraft(): QuoteDraftContextValue {
  const value = useContext(QuoteDraftContext);
  if (!value) throw new Error('useQuoteDraft must be used inside QuoteDraftProvider');
  return value;
}
