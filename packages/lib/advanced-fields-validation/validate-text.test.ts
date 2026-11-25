import { describe, expect, it } from 'vitest';

import type { TTextFieldMeta } from '../types/field-meta';
import { validateTextField } from './validate-text';

const meta = (extra: Partial<TTextFieldMeta>): TTextFieldMeta => ({ type: 'text', ...extra });

describe('validateTextField input kinds', () => {
  it('has no errors for an empty value on a non-required field of any kind', () => {
    expect(validateTextField('', meta({ inputKind: 'email' }), true)).toEqual([]);
  });

  it('gives only the required error for an empty required field', () => {
    expect(validateTextField('', meta({ inputKind: 'phone', required: true }), true)).toEqual(['Value is required']);
  });

  it('reports a format error for a bad email', () => {
    expect(validateTextField('nope', meta({ inputKind: 'email' }), true)).toHaveLength(1);
  });

  it('accepts a good phone number', () => {
    expect(validateTextField('+1 415 555 2671', meta({ inputKind: 'phone' }), true)).toEqual([]);
  });

  it('applies minLength', () => {
    expect(validateTextField('ab', meta({ minLength: 3 }), true)).toHaveLength(1);
    expect(validateTextField('abc', meta({ minLength: 3 }), true)).toEqual([]);
  });

  it('still applies the character limit', () => {
    expect(validateTextField('abcd', meta({ characterLimit: 3 }), true)).toHaveLength(1);
  });

  it('is unchanged for a field with no inputKind', () => {
    expect(validateTextField('anything at all', meta({}), true)).toEqual([]);
  });

  it('rejects a field whose pattern is unsafe, when the field is created', () => {
    expect(validateTextField('', meta({ pattern: '(a+)+$' }))).toHaveLength(1);
    expect(validateTextField('', meta({ pattern: '(' }))).toHaveLength(1);
  });

  it('accepts a field with a safe pattern at creation', () => {
    expect(validateTextField('', meta({ pattern: '\\d+' }))).toEqual([]);
  });
});
