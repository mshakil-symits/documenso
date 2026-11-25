import { describe, expect, it } from 'vitest';

import { ZTextFieldMeta } from './field-meta';

const base = { type: 'text' as const };

describe('ZTextFieldMeta input kinds', () => {
  it('keeps inputKind and the phone options', () => {
    const parsed = ZTextFieldMeta.parse({
      ...base,
      inputKind: 'phone',
      defaultCountry: 'us',
      allowedCountries: ['us', 'gb'],
    });

    expect(parsed.inputKind).toBe('phone');
    expect(parsed.defaultCountry).toBe('us');
    expect(parsed.allowedCountries).toEqual(['us', 'gb']);
  });

  it('keeps the date options and pattern', () => {
    const parsed = ZTextFieldMeta.parse({
      ...base,
      inputKind: 'date',
      dateFormat: 'dd/MM/yyyy',
      minDate: '2026-01-01',
      maxDate: '2026-12-31',
      pattern: '^\\d+$',
      patternMessage: 'Digits only',
      minLength: 2,
      multiline: true,
    });

    expect(parsed).toMatchObject({
      dateFormat: 'dd/MM/yyyy',
      minDate: '2026-01-01',
      pattern: '^\\d+$',
      minLength: 2,
      multiline: true,
    });
  });

  it('parses old meta without inputKind and leaves it undefined', () => {
    const parsed = ZTextFieldMeta.parse({ ...base, characterLimit: 10, label: 'Name' });

    expect(parsed.inputKind).toBeUndefined();
  });

  it('rejects an unknown inputKind', () => {
    expect(ZTextFieldMeta.safeParse({ ...base, inputKind: 'fax' }).success).toBe(false);
  });

  it('rejects a defaultCountry that is not two letters', () => {
    expect(ZTextFieldMeta.safeParse({ ...base, inputKind: 'phone', defaultCountry: 'USA' }).success).toBe(false);
  });

  it('describes itself to the OpenAPI generator (no transforms or refinements in the shape)', () => {
    // zod-openapi cannot describe ZodEffects, and the field meta is part of the API's response schemas
    for (const key of ['pattern', 'defaultCountry', 'allowedCountries', 'inputKind']) {
      const shape = ZTextFieldMeta.shape[key as keyof typeof ZTextFieldMeta.shape];

      expect(JSON.stringify(shape._def)).not.toContain('ZodEffects');
    }
  });
});
