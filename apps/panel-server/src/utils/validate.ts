/** Parses a request body as JSON, returning null on invalid JSON or a non-object body. */
export async function parseJsonBody(req: {
    json: () => Promise<unknown>;
}): Promise<Record<string, unknown> | null> {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return null;
    return body as Record<string, unknown>;
}

export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isPositiveIntegerInRange(
    value: unknown,
    max: number
): value is number {
    return isPositiveInteger(value) && value <= max;
}
