import { AppError, AppErrorCode } from '../errors/app-error';
import { isSafeRegex } from '../utils/safe-regex';

/**
 * Refuses TEXT field meta whose pattern could never be used: unsafe or invalid, or a "pattern" input kind with
 * no pattern (it would reject every value). Other field types and plain meta pass. Used wherever a field is
 * created or updated, so a bad pattern is caught when the author saves it, never when a signer meets it.
 */
export const assertTextFieldMetaUsable = (fieldMeta: unknown): void => {
  if (!fieldMeta || typeof fieldMeta !== 'object') {
    return;
  }

  const meta = fieldMeta as { type?: string; pattern?: unknown; inputKind?: unknown };

  if (typeof meta.type === 'string' && meta.type.toLowerCase() !== 'text') {
    return;
  }

  if (typeof meta.pattern === 'string' && meta.pattern !== '' && !isSafeRegex(meta.pattern)) {
    throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Field meta pattern is invalid or too complex' });
  }

  if (meta.inputKind === 'pattern' && !(typeof meta.pattern === 'string' && meta.pattern !== '')) {
    throw new AppError(AppErrorCode.INVALID_BODY, { message: 'A custom format field needs a pattern' });
  }
};
