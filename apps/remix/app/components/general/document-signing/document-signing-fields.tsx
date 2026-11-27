import { cn } from '@documenso/ui/lib/utils';
import { Loader } from 'lucide-react';
import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

export const DocumentSigningFieldsLoader = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background">
      <Loader className="h-5 w-5 animate-spin text-primary md:h-8 md:w-8" />
    </div>
  );
};

export const DocumentSigningFieldsUninserted = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="whitespace-pre-wrap text-[clamp(0.425rem,25cqw,0.825rem)] text-foreground duration-200 group-hover:text-recipient-green">
      {children}
    </p>
  );
};

type DocumentSigningFieldsInsertedProps = {
  children: React.ReactNode;

  /**
   * The text alignment of the field.
   *
   * Defaults to left.
   */
  textAlign?: 'left' | 'center' | 'right';

  isSingleLine?: boolean;
};

export const DocumentSigningFieldsInserted = ({
  children,
  textAlign = 'left',
  isSingleLine = false,
}: DocumentSigningFieldsInsertedProps) => {
  const $box = useRef<HTMLDivElement>(null);
  const $text = useRef<HTMLParagraphElement>(null);

  const isOverflowing = useFitTextToBox($box, $text, children);

  return (
    <div
      ref={$box}
      className={cn('flex h-full w-full', {
        'items-center overflow-hidden': !isOverflowing,
        'items-start overflow-visible': isOverflowing,
      })}
    >
      <p
        ref={$text}
        className={cn(
          // No transition: the fit below reads the layout right after each font size change.
          'w-full text-left text-[clamp(0.425rem,25cqw,0.825rem)] text-foreground leading-[1.1]',
          {
            'whitespace-pre-wrap break-words': !isSingleLine,
            'whitespace-nowrap': isSingleLine,
            '!text-center': textAlign === 'center',
            '!text-right': textAlign === 'right',
          },
        )}
      >
        {children}
      </p>
    </div>
  );
};

// Below this an answer is unreadable even zoomed in.
const MIN_FIT_FONT_SIZE_PX = 5;

const FIT_FONT_SIZE_STEP_PX = 0.5;

/**
 * Shrinks the text's font until every line fits the field, and reports whether it still overflows at the
 * smallest size. A field sized for one line on the PDF is a few pixels tall on a phone, where a multi-line
 * answer would otherwise show only its middle line. The signed PDF never hides a line either: it runs a
 * multi-line answer below the box.
 */
const useFitTextToBox = (
  $box: React.RefObject<HTMLElement | null>,
  $text: React.RefObject<HTMLElement | null>,
  content: React.ReactNode,
) => {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const box = $box.current;
    const text = $text.current;

    if (!box || !text) {
      return;
    }

    const fit = () => {
      text.style.fontSize = '';

      let fontSize = parseFloat(window.getComputedStyle(text).fontSize);

      const overflows = () => text.scrollHeight > box.clientHeight || text.scrollWidth > text.clientWidth;

      while (overflows() && fontSize - FIT_FONT_SIZE_STEP_PX >= MIN_FIT_FONT_SIZE_PX) {
        fontSize -= FIT_FONT_SIZE_STEP_PX;
        text.style.fontSize = `${fontSize}px`;
      }

      setIsOverflowing(overflows());
    };

    fit();

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(box);

    return () => {
      resizeObserver.disconnect();
    };
  }, [$box, $text, content]);

  return isOverflowing;
};
