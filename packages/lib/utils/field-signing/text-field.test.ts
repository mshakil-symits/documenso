import { describe, expect, it } from 'vitest';

import type { TTextFieldMeta } from '../../types/field-meta';
import { dateFormatsFor, formatTextForDisplay, splitTextFieldErrors, textInputTypeFor } from './text-field';

const meta = (extra: Partial<TTextFieldMeta>): TTextFieldMeta => ({ type: 'text', ...extra });

describe('formatTextForDisplay', () => {
  it('shows a phone number in international format', () => {
    expect(formatTextForDisplay('+14155552671', meta({ inputKind: 'phone' }))).toBe('+1 415 555 2671');
  });

  it('leaves a phone value it cannot parse as it is', () => {
    expect(formatTextForDisplay('not a number', meta({ inputKind: 'phone' }))).toBe('not a number');
  });

  it('leaves every other kind and plain text unchanged', () => {
    expect(formatTextForDisplay('a@b.com', meta({ inputKind: 'email' }))).toBe('a@b.com');
    expect(formatTextForDisplay('2026-03-09', meta({ inputKind: 'date' }))).toBe('2026-03-09');
    expect(formatTextForDisplay('+14155552671', meta({}))).toBe('+14155552671');
  });
});

describe('textInputTypeFor', () => {
  it('maps the kinds to the matching input', () => {
    expect(textInputTypeFor(meta({ inputKind: 'email' }))).toBe('email');
    expect(textInputTypeFor(meta({ inputKind: 'phone' }))).toBe('tel');
    expect(textInputTypeFor(meta({ inputKind: 'date' }))).toBe('date');
    expect(textInputTypeFor(meta({ inputKind: 'time' }))).toBe('time');
  });

  it('uses a plain text box when the date format is not the native one', () => {
    expect(textInputTypeFor(meta({ inputKind: 'date', dateFormat: 'dd/MM/yyyy' }))).toBe('text');
    expect(textInputTypeFor(meta({ inputKind: 'datetime' }))).toBe('text');
    expect(textInputTypeFor(meta({ inputKind: 'currency' }))).toBe('text');
    expect(textInputTypeFor(meta({ inputKind: 'pattern', pattern: '\\d+' }))).toBe('text');
  });

  it('keeps the textarea for plain and multiline text', () => {
    expect(textInputTypeFor(meta({}))).toBe('textarea');
    expect(textInputTypeFor(meta({ inputKind: 'text' }))).toBe('textarea');
    expect(textInputTypeFor(meta({ inputKind: 'email', multiline: true }))).toBe('textarea');
  });
});

describe('splitTextFieldErrors', () => {
  it('sorts the required, character limit and format messages', () => {
    expect(
      splitTextFieldErrors([
        'Value is required',
        'Value length (5) exceeds the character limit (3)',
        'Enter a valid email address',
      ]),
    ).toEqual({
      required: ['Value is required'],
      characterLimit: ['Value length (5) exceeds the character limit (3)'],
      format: ['Enter a valid email address'],
    });
  });
});

describe('dateFormatsFor', () => {
  it('offers date-only formats for a date', () => {
    const formats = dateFormatsFor('date');

    expect(formats).toContain('yyyy-MM-dd');
    expect(formats).toContain('dd/MM/yyyy');
    expect(formats.some((format) => /h|H/.test(format))).toBe(false);
  });

  it('offers formats with a time for a datetime', () => {
    const formats = dateFormatsFor('datetime');

    expect(formats).toContain('yyyy-MM-dd HH:mm');
    expect(formats.every((format) => /h|H/.test(format))).toBe(true);
  });

  it('offers time-only formats for a time', () => {
    expect(dateFormatsFor('time')).toEqual(['HH:mm', 'hh:mm a']);
  });
});
