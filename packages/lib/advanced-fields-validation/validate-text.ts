import type { TTextFieldMeta as TextFieldMeta } from '../types/field-meta';
import { isSafeRegex, normaliseTextValue } from './text-kinds';

export const validateTextField = (
  value: string,
  fieldMeta: TextFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { characterLimit, readOnly, required, fontSize } = fieldMeta;

  if (required && !value && isSigningPage) {
    errors.push('Value is required');
  }

  if (characterLimit !== undefined && characterLimit > 0 && value.length > characterLimit) {
    errors.push(`Value length (${value.length}) exceeds the character limit (${characterLimit})`);
  }

  if (fieldMeta.minLength && value.length > 0 && value.length < fieldMeta.minLength) {
    errors.push(`Value length (${value.length}) is below the minimum length (${fieldMeta.minLength})`);
  }

  if (fieldMeta.pattern && !isSafeRegex(fieldMeta.pattern)) {
    errors.push('The pattern is invalid or too complex');
  }

  if (value.length > 0) {
    const normalised = normaliseTextValue(value, fieldMeta);

    if (!normalised.ok) {
      errors.push(normalised.error);
    }
  }

  if (readOnly && value.length < 1) {
    errors.push('A read-only field must have text');
  }

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  if (fontSize && (fontSize < 8 || fontSize > 96)) {
    errors.push('Font size must be between 8 and 96.');
  }

  return errors;
};
