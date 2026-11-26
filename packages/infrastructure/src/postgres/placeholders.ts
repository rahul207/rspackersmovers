import type {
  ConsentRepository,
  ContactRequestRepository,
  QuoteRepository,
  VisitorAnalyticsRepository,
} from '@rs/application';

/**
 * FUTURE POSTGRESQL ADAPTERS - PLACEHOLDERS ONLY.
 *
 * These classes document the seam that replaces the XLSX repositories. They are intentionally
 * not wired into the composition root and throw when called. See docs/postgres-migration.md
 * for the table mapping and docs/migrations/001_initial.sql for the proposed schema.
 */
export class PostgresNotImplementedError extends Error {
  constructor(adapter: string) {
    super(`${adapter} is a placeholder. Implement it and set DATABASE_URL to migrate off XLSX.`);
    this.name = 'PostgresNotImplementedError';
  }
}

const notImplemented = (adapter: string): never => {
  throw new PostgresNotImplementedError(adapter);
};

export class PostgresQuoteRepository implements QuoteRepository {
  save(): Promise<void> {
    return notImplemented('PostgresQuoteRepository');
  }
  existsByReference(): Promise<boolean> {
    return notImplemented('PostgresQuoteRepository');
  }
  deleteOlderThan(): Promise<number> {
    return notImplemented('PostgresQuoteRepository');
  }
  ping(): Promise<void> {
    return notImplemented('PostgresQuoteRepository');
  }
}

export class PostgresContactRequestRepository implements ContactRequestRepository {
  save(): Promise<void> {
    return notImplemented('PostgresContactRequestRepository');
  }
  existsById(): Promise<boolean> {
    return notImplemented('PostgresContactRequestRepository');
  }
  deleteOlderThan(): Promise<number> {
    return notImplemented('PostgresContactRequestRepository');
  }
  ping(): Promise<void> {
    return notImplemented('PostgresContactRequestRepository');
  }
}

export class PostgresConsentRepository implements ConsentRepository {
  save(): Promise<void> {
    return notImplemented('PostgresConsentRepository');
  }
  deleteOlderThan(): Promise<number> {
    return notImplemented('PostgresConsentRepository');
  }
  ping(): Promise<void> {
    return notImplemented('PostgresConsentRepository');
  }
}

export class PostgresVisitorAnalyticsRepository implements VisitorAnalyticsRepository {
  recordVisit(): Promise<void> {
    return notImplemented('PostgresVisitorAnalyticsRepository');
  }
  deleteOlderThan(): Promise<number> {
    return notImplemented('PostgresVisitorAnalyticsRepository');
  }
  ping(): Promise<void> {
    return notImplemented('PostgresVisitorAnalyticsRepository');
  }
}
