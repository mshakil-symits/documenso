import { describe, expect, it } from 'vitest';

import { parseApiV1FieldMeta } from './parse-api-v1-field-meta';

describe('parseApiV1FieldMeta', () => {
  it('keeps a date field meta, so its font size reaches the signed PDF', () => {
    const result = parseApiV1FieldMeta('DATE', { type: 'date', label: 'Date', fontSize: 49 });

    expect(result.success).toBe(true);
    expect(result.success && result.data?.fontSize).toBe(49);
  });

  it('gives a date field with no meta none, as before', () => {
    expect(parseApiV1FieldMeta('DATE', undefined)).toEqual({ success: true, data: undefined });
  });

  it('gives signature, initials, email and name fields no meta, as before', () => {
    for (const type of ['SIGNATURE', 'INITIALS', 'EMAIL', 'NAME'] as const) {
      expect(parseApiV1FieldMeta(type, { type: type.toLowerCase() })).toEqual({ success: true, data: undefined });
    }
  });

  it('parses the advanced types with their own schema', () => {
    const text = parseApiV1FieldMeta('TEXT', { type: 'text', fontSize: 49 });

    expect(text.success && text.data?.fontSize).toBe(49);
    expect(parseApiV1FieldMeta('FREE_SIGNATURE', undefined).success).toBe(false);
  });
});
