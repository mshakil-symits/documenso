import { SOURCE_CODE_URL } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';

export type SourceCodeLinkProps = {
  className?: string;
};

/**
 * Offers the corresponding source to everyone using the app (AGPL-3.0 section 13).
 */
export const SourceCodeLink = ({ className }: SourceCodeLinkProps) => {
  return (
    <a
      href={SOURCE_CODE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="source-code-link"
      className={cn(
        'fixed bottom-1 left-2 z-30 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/70 hover:text-foreground print:hidden',
        className,
      )}
    >
      <Trans>Source code (AGPL-3.0)</Trans>
    </a>
  );
};
