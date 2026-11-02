/** Three-way merging keeps an open form from replacing newer shared fields. */
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function mergeDraft<T>(original: T, draft: T, current: T, path = ""): T {
  if (equal(draft, original)) return current;
  if (equal(current, original) || equal(current, draft)) return draft;
  if (path === "comments" && Array.isArray(original) && Array.isArray(draft) && Array.isArray(current)) {
    return [...current, ...draft.filter(item => !current.some(saved => equal(saved, item)))] as T;
  }
  if (object(original) && object(draft) && object(current)) {
    const result: Record<string, unknown> = {...current};
    for (const key of new Set([...Object.keys(original), ...Object.keys(draft)])) {
      const value = mergeDraft(original[key], draft[key], current[key], path ? `${path}.${key}` : key);
      if (value === undefined) delete result[key]; else result[key] = value;
    }
    return result as T;
  }
  throw new Error(`Another teammate changed ${path || "this field"}. Your draft is still open. Copy your changes, then reopen the latest record to resolve the conflict.`);
}
