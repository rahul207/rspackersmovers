export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvariantViolationError extends DomainError {
  constructor(message: string) {
    super('INVARIANT_VIOLATION', message);
  }
}

export class PickupDateError extends DomainError {
  constructor(message: string) {
    super('PICKUP_DATE_INVALID', message);
  }
}

export class DuplicateReferenceError extends DomainError {
  constructor(reference: string) {
    super('DUPLICATE_REFERENCE', `Reference ${reference} already exists`);
  }
}
