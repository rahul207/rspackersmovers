import type { SiteContent } from '@rs/shared';

export interface ContentRepository {
  get(): Promise<SiteContent>;
}
