import type { TTextFieldMeta } from '@documenso/lib/types/field-meta';
import { dateFormatsFor } from '@documenso/lib/utils/field-signing/text-field';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

export type TextInputKindKey =
  | 'inputKind'
  | 'minLength'
  | 'pattern'
  | 'patternMessage'
  | 'defaultCountry'
  | 'dateFormat'
  | 'minDate'
  | 'maxDate';

const DATE_KINDS = ['date', 'time', 'datetime'];

/** The options that do not belong to a kind: cleared when the author switches to it. */
const staleKeysFor = (kind: string): TextInputKindKey[] => {
  const stale: TextInputKindKey[] = ['dateFormat'];

  if (!DATE_KINDS.includes(kind)) {
    stale.push('minDate', 'maxDate');
  }

  if (kind !== 'pattern') {
    stale.push('pattern', 'patternMessage');
  }

  if (kind !== 'phone') {
    stale.push('defaultCountry');
  }

  if (kind !== 'text' && kind !== 'pattern') {
    stale.push('minLength');
  }

  return stale;
};

type TextInputKindSettingsProps = {
  meta: Pick<TTextFieldMeta, TextInputKindKey>;
  onChange: (key: TextInputKindKey, value: string) => void;
};

/** What a TEXT field asks the signer for (email, phone, a date ...) and the options of that kind. */
export const TextInputKindSettings = ({ meta, onChange }: TextInputKindSettingsProps) => {
  const { t } = useLingui();
  const kind = meta.inputKind ?? 'text';
  const [country, setCountry] = useState(meta.defaultCountry ?? '');
  const isDateKind = kind === 'date' || kind === 'time' || kind === 'datetime';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Input type</Trans>
        </Label>
        <Select
          value={kind}
          onValueChange={(value) => {
            if (value) {
              onChange('inputKind', value);
              // Options of the previous kind are hidden for the new one, so they must not keep applying.
              for (const key of staleKeysFor(value)) {
                onChange(key, '');
              }
            }
          }}
        >
          <SelectTrigger className="mt-2 bg-background" data-testid="text-input-kind">
            <SelectValue placeholder={t`Select input type`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">{t`Text`}</SelectItem>
            <SelectItem value="email">{t`Email address`}</SelectItem>
            <SelectItem value="phone">{t`Phone number`}</SelectItem>
            <SelectItem value="date">{t`Date`}</SelectItem>
            <SelectItem value="time">{t`Time`}</SelectItem>
            <SelectItem value="datetime">{t`Date and time`}</SelectItem>
            <SelectItem value="currency">{t`Amount`}</SelectItem>
            <SelectItem value="pattern">{t`Custom format`}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {kind === 'phone' && (
        <div>
          <Label>
            <Trans>Default country (2 letters, e.g. US)</Trans>
          </Label>
          <Input
            id="defaultCountry"
            className="mt-2 bg-background"
            maxLength={2}
            value={country}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();

              setCountry(next);

              // Half a country code is not valid meta, so it is only passed on when empty or complete.
              if (next.length === 0 || next.length === 2) {
                onChange('defaultCountry', next);
              }
            }}
          />
        </div>
      )}

      {isDateKind && (
        <>
          <div>
            <Label>
              <Trans>Format</Trans>
            </Label>
            <Select
              value={meta.dateFormat || undefined}
              onValueChange={(value) => value && onChange('dateFormat', value)}
            >
              <SelectTrigger className="mt-2 bg-background">
                <SelectValue placeholder={t`Default format`} />
              </SelectTrigger>
              <SelectContent>
                {dateFormatsFor(kind).map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind !== 'time' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  <Trans>Earliest date</Trans>
                </Label>
                <Input
                  id="minDate"
                  type="date"
                  className="mt-2 bg-background"
                  value={meta.minDate ?? ''}
                  onChange={(e) => onChange('minDate', e.target.value)}
                />
              </div>
              <div>
                <Label>
                  <Trans>Latest date</Trans>
                </Label>
                <Input
                  id="maxDate"
                  type="date"
                  className="mt-2 bg-background"
                  value={meta.maxDate ?? ''}
                  onChange={(e) => onChange('maxDate', e.target.value)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {kind === 'pattern' && (
        <>
          <div>
            <Label>
              <Trans>Pattern (regular expression, matches the whole value)</Trans>
            </Label>
            <Input
              id="pattern"
              className="mt-2 bg-background"
              placeholder="\d{3}-\d{2}-\d{4}"
              value={meta.pattern ?? ''}
              onChange={(e) => onChange('pattern', e.target.value)}
            />
          </div>
          <div>
            <Label>
              <Trans>Message when it does not match</Trans>
            </Label>
            <Input
              id="patternMessage"
              className="mt-2 bg-background"
              value={meta.patternMessage ?? ''}
              onChange={(e) => onChange('patternMessage', e.target.value)}
            />
          </div>
        </>
      )}

      {(kind === 'text' || kind === 'pattern') && (
        <div>
          <Label>
            <Trans>Minimum length</Trans>
          </Label>
          <Input
            id="minLength"
            type="number"
            min={0}
            className="mt-2 bg-background"
            value={meta.minLength ?? ''}
            onChange={(e) => onChange('minLength', e.target.value)}
          />
        </div>
      )}
    </div>
  );
};
