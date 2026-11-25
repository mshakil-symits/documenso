import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { dateFieldsToAutoInsert } from '@documenso/lib/utils/auto-insert-date-fields';
import { env } from '@documenso/lib/utils/env';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { Field, Recipient } from '@prisma/client';
import { useRevalidator } from 'react-router';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAutoInsertDateProps = {
  recipient: Pick<Recipient, 'id' | 'token'>;
  fields: Field[];
};

/**
 * Fills in the recipient's DATE fields as soon as they open the document, with no click and no dialog
 * (NEXT_PUBLIC_AUTO_INSERT_DATE_FIELDS=true). Renders nothing. A field that is already inserted is left
 * alone, so a reload never signs twice.
 */
export const DocumentSigningAutoInsertDate = ({ recipient, fields }: DocumentSigningAutoInsertDateProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();
  const { derivedRecipientActionAuth } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation();

  unsafe_useEffectOnce(() => {
    const enabled = env('NEXT_PUBLIC_AUTO_INSERT_DATE_FIELDS') === 'true';
    const dateFields = dateFieldsToAutoInsert(fields, derivedRecipientActionAuth, enabled);

    if (dateFields.length === 0) {
      return;
    }

    // Only ACCOUNT / explicit-none / no auth reach here (the helper drops manual auth types).
    const authOptions = derivedRecipientActionAuth.includes(DocumentAuth.ACCOUNT)
      ? { type: DocumentAuth.ACCOUNT }
      : derivedRecipientActionAuth.includes(DocumentAuth.EXPLICIT_NONE)
        ? { type: DocumentAuth.EXPLICIT_NONE }
        : undefined;

    void (async () => {
      const results = await Promise.allSettled(
        dateFields.map(async (field) =>
          signFieldWithToken({
            token: recipient.token,
            fieldId: field.id,
            value: new Date().toISOString(),
            isBase64: false,
            authOptions,
          }),
        ),
      );

      if (results.some((result) => result.status === 'rejected')) {
        toast({
          title: _(msg`Error`),
          description: _(msg`We could not fill in the date automatically. Please click the date field to fill it in.`),
          duration: 5000,
          variant: 'destructive',
        });
      }

      await revalidate();
    })();
  });

  return null;
};
