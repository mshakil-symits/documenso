import { match } from 'ts-pattern';

import {
  ZCheckboxFieldMeta,
  ZDateFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../types/field-meta';

type ApiV1FieldType =
  | 'RADIO'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'NUMBER'
  | 'TEXT'
  | 'DATE'
  | 'SIGNATURE'
  | 'INITIALS'
  | 'EMAIL'
  | 'NAME'
  | 'FREE_SIGNATURE';

/**
 * The meta the v1 API stores for a new field. A date field keeps the meta it is given (its font size and the
 * like reach the signed PDF); signature, initials, email and name fields keep none, as before.
 */
export const parseApiV1FieldMeta = (type: ApiV1FieldType, fieldMeta: unknown) =>
  match(type)
    .with('RADIO', () => ZRadioFieldMeta.safeParse(fieldMeta))
    .with('CHECKBOX', () => ZCheckboxFieldMeta.safeParse(fieldMeta))
    .with('DROPDOWN', () => ZDropdownFieldMeta.safeParse(fieldMeta))
    .with('NUMBER', () => ZNumberFieldMeta.safeParse(fieldMeta))
    .with('TEXT', () => ZTextFieldMeta.safeParse(fieldMeta))
    .with('DATE', () => (fieldMeta ? ZDateFieldMeta.safeParse(fieldMeta) : { success: true as const, data: undefined }))
    .with('SIGNATURE', 'INITIALS', 'EMAIL', 'NAME', () => ({ success: true as const, data: undefined }))
    .with('FREE_SIGNATURE', () => ({
      success: false as const,
      error: 'FREE_SIGNATURE is not supported',
      data: undefined,
    }))
    .exhaustive();
