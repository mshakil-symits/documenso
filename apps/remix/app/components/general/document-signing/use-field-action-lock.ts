import { useCallback, useRef, useState } from 'react';

/**
 * Runs one sign or remove action at a time for a field, and reports it busy until the action has finished,
 * including the page revalidation that brings back the field's new state. Until then the field still looks
 * empty, and on a slow connection a second tap would insert it again and fail with "already inserted".
 */
export const useFieldActionLock = () => {
  const isRunning = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const runExclusive = useCallback(
    <TArgs extends unknown[]>(action: (...args: TArgs) => Promise<void>) =>
      async (...args: TArgs) => {
        if (isRunning.current) {
          return;
        }

        isRunning.current = true;
        setIsBusy(true);

        try {
          await action(...args);
        } finally {
          isRunning.current = false;
          setIsBusy(false);
        }
      },
    [],
  );

  return { isBusy, runExclusive };
};
