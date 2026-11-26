import { useEffect } from 'react';

const BASE_TITLE = 'RS Packers & Movers';

/** Sets the document title for a route and restores the previous one on unmount. */
export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = `${title} | ${BASE_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
