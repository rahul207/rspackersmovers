import type { SiteContent } from '@rs/shared';
import { assertDemonstrationContent } from '@rs/domain';
import type { ContentRepository } from './ports';

export class GetSiteContent {
  constructor(private readonly content: ContentRepository) {}

  async execute(): Promise<SiteContent> {
    const c = await this.content.get();
    assertDemonstrationContent(c);
    return c;
  }
}
