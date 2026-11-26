import { createContext, useContext } from 'react';
import type { PublicConfig } from '@rs/shared';

export const SiteConfigContext = createContext<PublicConfig | null>(null);

export function useSiteConfig(): PublicConfig {
  const config = useContext(SiteConfigContext);
  if (!config) throw new Error('useSiteConfig must be used inside SiteConfigProvider');
  return config;
}
