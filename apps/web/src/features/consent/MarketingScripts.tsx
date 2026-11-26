import { useConsent } from './consentContext';

/**
 * Placeholder for marketing/advertising tags. The site currently ships NO marketing script.
 * Any pixel or tag added in future must be mounted here and only when `allows('marketing')`
 * is true, and must never receive precise coordinates, quote details or personal data.
 */
export function MarketingScripts() {
  const { allows } = useConsent();
  if (!allows('marketing')) return null;
  return null;
}
