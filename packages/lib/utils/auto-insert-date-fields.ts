import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';

// Passkey, password and 2FA recipients are meant to act on each field by hand, so nothing is signed for them.
const MANUAL_ACTION_AUTH_TYPES: string[] = ['PASSKEY', 'PASSWORD', 'TWO_FACTOR_AUTH'];

/**
 * The DATE fields to fill in for a recipient the moment they open the document (Engyj: the signing date
 * needs no click). Only when `enabled` (NEXT_PUBLIC_AUTO_INSERT_DATE_FIELDS), and never for a recipient
 * whose action auth asks for a manual step.
 */
export const dateFieldsToAutoInsert = <T extends Pick<Field, 'id' | 'type' | 'inserted'>>(
  fields: T[],
  actionAuth: string[],
  enabled: boolean,
): T[] => {
  if (!enabled || actionAuth.some((auth) => MANUAL_ACTION_AUTH_TYPES.includes(auth))) {
    return [];
  }

  return fields.filter((field) => field.type === FieldType.DATE && !field.inserted);
};
