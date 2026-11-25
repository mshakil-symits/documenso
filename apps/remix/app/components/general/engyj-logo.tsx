import { cn } from '@documenso/ui/lib/utils';

export type EngyjLogoProps = {
  className?: string;
};

/**
 * Engyj wordmark. Two images are swapped with the `dark` class so the logo stays legible in both themes.
 */
export const EngyjLogo = ({ className }: EngyjLogoProps) => {
  return (
    <>
      <img
        src="/static/engyj/logo-light.png"
        alt="Engyj"
        className={cn('block w-auto dark:hidden', className)}
        draggable={false}
      />
      <img
        src="/static/engyj/logo-dark.png"
        alt="Engyj"
        className={cn('hidden w-auto dark:block', className)}
        draggable={false}
      />
    </>
  );
};

/**
 * Engyj "j" mark for narrow layouts.
 */
export const EngyjLogoIcon = ({ className }: EngyjLogoProps) => {
  return (
    <>
      <img
        src="/static/engyj/icon-light.png"
        alt="Engyj"
        className={cn('block w-auto dark:hidden', className)}
        draggable={false}
      />
      <img
        src="/static/engyj/icon-dark.png"
        alt="Engyj"
        className={cn('hidden w-auto dark:block', className)}
        draggable={false}
      />
    </>
  );
};
