import { createContext } from 'react';

/** When true, deferred sections mount immediately (e.g. after an in-page anchor navigation). */
export const EagerMountContext = createContext(false);
