// Tiny runtime shape guard for the client data-load seams. The explorer slices
// (public/explorer/*.json) are emitted by an UNTYPED build script; a dropped or
// renamed field there would otherwise sail past TypeScript and silently degrade
// reach to zero. assertShape throws a descriptive Error naming the label and the
// missing key so the failure surfaces in the explorers' error/retry state
// instead of rendering half-empty numbers. No zod, no deps.

/** Assert `obj` is a non-null object carrying every key in `requiredKeys`.
 * Throws an Error naming `label` + the offending key on the first failure. */
export function assertShape(
  obj: unknown,
  requiredKeys: readonly string[],
  label: string,
): void {
  if (obj == null || typeof obj !== "object") {
    throw new Error(`${label}: expected an object, got ${obj === null ? "null" : typeof obj}`);
  }
  const rec = obj as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in rec)) {
      throw new Error(`${label}: missing required field "${key}"`);
    }
  }
}
