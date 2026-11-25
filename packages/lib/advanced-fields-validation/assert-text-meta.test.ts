import { describe, expect, it } from 'vitest';

import { assertTextFieldMetaUsable } from './assert-text-meta';

describe('assertTextFieldMetaUsable', () => {
  it('passes meta without a pattern, other types and nothing', () => {
    expect(() => assertTextFieldMetaUsable(undefined)).not.toThrow();
    expect(() => assertTextFieldMetaUsable({ type: 'text', inputKind: 'email' })).not.toThrow();
    expect(() => assertTextFieldMetaUsable({ type: 'number', pattern: '(a+)+' })).not.toThrow();
  });

  it('rejects an unsafe pattern', () => {
    expect(() => assertTextFieldMetaUsable({ type: 'text', pattern: '(a+)+$' })).toThrow();
  });

  it('rejects a custom-format kind with no pattern', () => {
    expect(() => assertTextFieldMetaUsable({ type: 'text', inputKind: 'pattern' })).toThrow();
  });

  it('accepts a safe pattern', () => {
    expect(() => assertTextFieldMetaUsable({ type: 'text', inputKind: 'pattern', pattern: '\\d{3}' })).not.toThrow();
  });
});
