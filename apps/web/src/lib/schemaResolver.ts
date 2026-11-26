import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/** Maps a zod issue path onto a top-level form field (`pickup.latitude` -> `pickup`). */
function headOf(path: ReadonlyArray<PropertyKey>): string {
  const first = path[0];
  return typeof first === 'string' || typeof first === 'number' ? String(first) : '';
}

interface ResolverOptions<T extends FieldValues> {
  /** Shape the form values into the object the schema expects. */
  toPayload: (values: T) => unknown;
  /** Extra checks that are cheaper to express outside of the shared schema. */
  extra?: (values: T) => Partial<Record<keyof T & string, string>>;
  /** Replace generic zod messages (for example empty-field wording). */
  messages?: (field: string, message: string, values: T) => string;
}

/** React-hook-form resolver backed by one of the shared zod schemas. */
export function createSchemaResolver<T extends FieldValues>(
  schema: ZodType,
  options: ResolverOptions<T>,
): Resolver<T> {
  return (values) => {
    const errors: Record<string, FieldError> = {};
    const result = schema.safeParse(options.toPayload(values));
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = headOf(issue.path);
        if (!field || errors[field]) continue;
        const message = options.messages
          ? options.messages(field, issue.message, values)
          : issue.message;
        errors[field] = { type: issue.code, message };
      }
    }
    const extra = options.extra?.(values) ?? {};
    for (const [field, message] of Object.entries(extra) as [string, string | undefined][]) {
      if (message && !errors[field]) errors[field] = { type: 'custom', message };
    }
    if (Object.keys(errors).length > 0) {
      return { values: {}, errors: errors as unknown as FieldErrors<T> };
    }
    return { values, errors: {} };
  };
}
