import { corsHeaders } from './cors.ts';
import { IDEMPOTENCY_KEY_HEADER } from './correlation.ts';

/**
 * Request validation helpers for edge functions (ADR-002).
 *
 * Provides lightweight validation without external dependencies.
 * For edge functions running in Deno, we avoid pulling in Zod to keep
 * cold-start times low. Instead we provide a simple schema-check pattern
 * and an idempotency-key enforcer.
 *
 * If validation needs grow, swap `validateBody` for Zod schemas.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult<T> {
  ok: true;
  data: T;
}

export interface ValidationError {
  ok: false;
  response: Response;
}

export type ValidateResult<T> = ValidationResult<T> | ValidationError;

/** A simple field-level validator spec. */
export interface FieldSpec {
  /** Field name on the incoming JSON object. */
  name: string;
  /** Expected type (typeof check). */
  type: 'string' | 'number' | 'boolean' | 'object';
  /** Whether the field is required. Defaults to true. */
  required?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validationError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

/**
 * Parses the request body as JSON and validates required fields.
 *
 * ```ts
 * const body = await validateBody<CreateEntity>(req, [
 *   { name: 'name', type: 'string' },
 *   { name: 'entity_type', type: 'string' },
 * ]);
 * if (!body.ok) return body.response;
 * // body.data is typed as CreateEntity
 * ```
 */
export async function validateBody<T>(
  req: Request,
  fields: FieldSpec[],
): Promise<ValidateResult<T>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return { ok: false, response: validationError('Invalid JSON body') };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: validationError('Request body must be a JSON object') };
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  for (const field of fields) {
    const value = obj[field.name];
    const required = field.required !== false; // default true

    if (value === undefined || value === null) {
      if (required) {
        errors.push(`Missing required field: ${field.name}`);
      }
      continue;
    }

    if (field.type === 'object' && Array.isArray(value)) {
      errors.push(`Field '${field.name}' must be a JSON object, not an array`);
    } else if (typeof value !== field.type) {
      errors.push(`Field '${field.name}' must be of type ${field.type}, got ${typeof value}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, response: validationError(errors.join('; ')) };
  }

  return { ok: true, data: obj as T };
}

// ---------------------------------------------------------------------------
// Idempotency key enforcement
// ---------------------------------------------------------------------------

/**
 * Requires an `x-idempotency-key` header on mutation requests (POST/PATCH).
 *
 * Returns `null` when the header is present (caller proceeds), or a
 * ready-to-return 400 response when missing.
 *
 * ```ts
 * if (req.method === 'POST' || req.method === 'PATCH') {
 *   const idemError = requireIdempotencyKey(req);
 *   if (idemError) return idemError;
 * }
 * ```
 */
export function requireIdempotencyKey(req: Request): Response | null {
  const key = req.headers.get(IDEMPOTENCY_KEY_HEADER);
  if (!key || key.trim().length === 0) {
    return validationError(`Missing required header: ${IDEMPOTENCY_KEY_HEADER}`, 400);
  }
  return null;
}
