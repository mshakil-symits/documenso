import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { dateFieldsToAutoInsert } from './auto-insert-date-fields';

const field = (id: number, type: FieldType, inserted = false) => ({ id, type, inserted });

describe('dateFieldsToAutoInsert', () => {
  it('returns only the DATE fields that are not inserted yet', () => {
    const fields = [
      field(1, FieldType.DATE),
      field(2, FieldType.DATE, true),
      field(3, FieldType.TEXT),
      field(4, FieldType.SIGNATURE),
    ];

    expect(dateFieldsToAutoInsert(fields, [], true).map((f) => f.id)).toEqual([1]);
  });

  it('returns every un-inserted DATE field when a recipient has several', () => {
    const fields = [field(1, FieldType.DATE), field(2, FieldType.DATE)];

    expect(dateFieldsToAutoInsert(fields, [], true).map((f) => f.id)).toEqual([1, 2]);
  });

  it('returns nothing when the feature is off', () => {
    expect(dateFieldsToAutoInsert([field(1, FieldType.DATE)], [], false)).toEqual([]);
  });

  it.each(['PASSKEY', 'PASSWORD', 'TWO_FACTOR_AUTH'])('returns nothing with %s action auth', (auth) => {
    expect(dateFieldsToAutoInsert([field(1, FieldType.DATE)], [auth], true)).toEqual([]);
  });

  it('still returns fields with account or no action auth', () => {
    expect(dateFieldsToAutoInsert([field(1, FieldType.DATE)], ['ACCOUNT'], true)).toHaveLength(1);
  });
});
