import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { TooltipArrow } from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningFieldContainerProps = {
  field: FieldWithSignature;
  loading?: boolean;
  children: React.ReactNode;

  /**
   * A function that is called before the field requires to be signed, or reauthed.
   *
   * Example, you may want to show a dialog prior to signing where they can enter a value.
   *
   * Once that action is complete, you will need to call `executeActionAuthProcedure` to proceed
   * regardless if it requires reauth or not.
   *
   * If the function returns true, we will proceed with the signing process. Otherwise if
   * false is returned we will not proceed.
   */
  onPreSign?: () => Promise<boolean> | boolean;

  /**
   * The function required to be executed to insert the field.
   *
   * The auth values will be passed in if available.
   */
  onSign?: (documentAuthValue?: TRecipientActionAuth) => Promise<void> | void;
  onRemove?: (fieldType?: string) => Promise<void> | void;

  /**
   * Called on a tap on the filled field instead of `onRemove`, e.g. to reopen its dialog with the answer.
   */
  onEdit?: () => void;
  type?: 'Date' | 'Initials' | 'Email' | 'Name' | 'Signature' | 'Text' | 'Radio' | 'Dropdown' | 'Number' | 'Checkbox';
  tooltipText?: string | null;
};

export const DocumentSigningFieldContainer = ({
  field,
  loading,
  onPreSign,
  onSign,
  onRemove,
  onEdit,
  children,
  type,
  tooltipText,
}: DocumentSigningFieldContainerProps) => {
  const { executeActionAuthProcedure, isAuthRedirectRequired } = useRequiredDocumentSigningAuthContext();

  const parsedFieldMeta = field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined;
  const readOnlyField = parsedFieldMeta?.readOnly || false;

  const handleInsertField = async () => {
    if (field.inserted || !onSign) {
      return;
    }

    // Bypass reauth for non signature fields.
    if (field.type !== FieldType.SIGNATURE) {
      const presignResult = await onPreSign?.();

      if (presignResult === false) {
        return;
      }

      await onSign();
      return;
    }

    if (isAuthRedirectRequired) {
      await executeActionAuthProcedure({
        onReauthFormSubmit: () => {
          // Do nothing since the user should be redirected.
        },
        actionTarget: field.type,
      });

      return;
    }

    // Handle any presign requirements, and halt if required.
    if (onPreSign) {
      const preSignResult = await onPreSign();

      if (preSignResult === false) {
        return;
      }
    }

    await executeActionAuthProcedure({
      onReauthFormSubmit: onSign,
      actionTarget: field.type,
    });
  };

  const onRemoveSignedFieldClick = async () => {
    if (!field.inserted) {
      return;
    }

    if (onEdit) {
      onEdit();
      return;
    }

    await onRemove?.();
  };

  const onClearCheckBoxValues = async (fieldType?: string) => {
    if (!field.inserted) {
      return;
    }

    await onRemove?.(fieldType);
  };

  return (
    <FieldRootContainer
      color={getRecipientColorStyles(field.fieldMeta?.readOnly ? 'readOnly' : 0)}
      field={field}
      // A filled field's ring and padding take room from its answer, which on a phone is only a few pixels tall.
      className={cn({
        'ring-0': field.inserted,
        'px-0.5 sm:px-2':
          field.inserted && field.type !== FieldType.SIGNATURE && field.type !== FieldType.FREE_SIGNATURE,
      })}
    >
      {!field.inserted && !loading && !readOnlyField && (
        <button
          type="submit"
          className="absolute inset-0 z-10 h-full w-full rounded-[2px]"
          onClick={async () => handleInsertField()}
        />
      )}

      {type === 'Checkbox' && field.inserted && !loading && !readOnlyField && (
        <button
          className="absolute -bottom-10 flex items-center justify-evenly rounded-md border bg-gray-900 opacity-0 group-hover:opacity-100"
          onClick={() => void onClearCheckBoxValues(type)}
        >
          <span className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100">
            <X className="h-4 w-4" />
          </span>
        </button>
      )}

      {/* A filled checkbox or radio takes taps on its own options, to change the answer in place. */}
      {type !== 'Checkbox' && type !== 'Radio' && field.inserted && !loading && !readOnlyField && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button className="absolute inset-0 z-10" onClick={onRemoveSignedFieldClick}></button>
          </TooltipTrigger>

          <TooltipContent className="border-0 bg-orange-300 fill-orange-300 text-orange-900" sideOffset={2}>
            {tooltipText && <p>{tooltipText}</p>}

            {onEdit ? <Trans>Edit</Trans> : <Trans>Remove</Trans>}
            <TooltipArrow />
          </TooltipContent>
        </Tooltip>
      )}

      {(field.type === FieldType.RADIO || field.type === FieldType.CHECKBOX) && field.fieldMeta?.label && (
        <FieldLabelChip label={field.fieldMeta.label} page={field.page} inserted={field.inserted} />
      )}

      {children}
    </FieldRootContainer>
  );
};

const rectsOverlap = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

type FieldLabelChipProps = {
  label: string;
  page: number;
  inserted: boolean;
};

/**
 * A checkbox or radio field's label, floating a fixed 64px above the field. It is display only, so taps go
 * through it, and it is hidden while it would cover another field: on a densely placed form (and on a phone,
 * where the page is scaled down) it would otherwise hide the boxes of the fields above.
 */
const FieldLabelChip = ({ label, page, inserted }: FieldLabelChipProps) => {
  const $label = useRef<HTMLDivElement>(null);

  // Hidden until measured, so it never flashes over a neighbour.
  const [coversField, setCoversField] = useState(true);

  useEffect(() => {
    let frame = 0;

    const check = () => {
      cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const $chip = $label.current;
        const $ownField = $chip?.closest('[data-field-type]');

        if (!$chip || !$ownField) {
          return;
        }

        const chipRect = $chip.getBoundingClientRect();

        const covers = Array.from(document.querySelectorAll('[data-field-type]')).some(($field) => {
          if ($field === $ownField) {
            return false;
          }

          const fieldRect = $field.getBoundingClientRect();

          return fieldRect.width > 0 && fieldRect.height > 0 && rectsOverlap(chipRect, fieldRect);
        });

        setCoversField(covers);
      });
    };

    check();

    // Fields move when the page is resized, and mount one by one as pages render.
    window.addEventListener('resize', check);

    const resizeObserver = new ResizeObserver(check);
    const $page = document.querySelector(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${page}"]`);

    if ($page) {
      resizeObserver.observe($page);
    }

    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(document.getElementById('document-field-portal-root') ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', check);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [page]);

  return (
    <div
      ref={$label}
      className={cn(
        'pointer-events-none absolute -top-16 right-0 left-0 rounded-md p-2 text-center text-gray-700 text-xs',
        {
          invisible: coversField,
          'border border-border bg-foreground/5': !inserted,
          'border border-primary bg-documenso-200': inserted,
        },
      )}
    >
      {label}
    </div>
  );
};
