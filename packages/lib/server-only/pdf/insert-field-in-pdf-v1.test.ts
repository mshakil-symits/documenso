import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertFieldInPDFV1 } from './insert-field-in-pdf-v1';

const FONTS = path.resolve(__dirname, '../../../../apps/remix/public/fonts');

const field = (type: FieldType, fieldMeta: Record<string, unknown>, customText = 'asd') =>
  ({
    id: 1,
    secondaryId: `f-${type}`,
    type,
    page: 1,
    positionX: 10,
    positionY: 10,
    width: 30,
    height: 2,
    customText,
    inserted: true,
    fieldMeta,
    signature: null,
    recipientId: 1,
    envelopeId: 'e',
    envelopeItemId: 'i',
  }) as unknown as FieldWithSignature;

const daOf = (pdf: PDFDocument, type: FieldType) =>
  pdf.getForm().getTextField(`text.f-${type}`).acroField.getDefaultAppearance() ?? '';

describe('insertFieldInPDFV1 font size', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async (url: string) => {
      const file = readFileSync(path.join(FONTS, path.basename(String(url))));

      return { arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [FieldType.TEXT, { type: 'text', fontSize: 49 }],
    [FieldType.DATE, { type: 'date', fontSize: 49 }],
    [FieldType.DROPDOWN, { type: 'dropdown', values: [{ value: 'asd' }], fontSize: 49 }],
  ])('prints a %s value at the font size its meta gives', async (type, meta) => {
    const pdf = await PDFDocument.create();
    pdf.addPage([2480, 3508]);

    await insertFieldInPDFV1(pdf, field(type, meta));

    expect(daOf(pdf, type)).toContain('49 Tf');
  });
});
