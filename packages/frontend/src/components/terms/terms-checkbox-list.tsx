import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRLink } from '@tinyrack/ui/components/link';
import { TRText } from '@tinyrack/ui/components/text';
import { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { TermItem } from '#frontend/queries/terms.ts';
import { TermsContentModal } from './terms-content-modal.tsx';

export type TermsConsentsField = {
  termsConsents: Record<string, boolean>;
};

type TermsCheckboxListProps<T extends FieldValues & TermsConsentsField> = {
  terms: TermItem[];
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  errors?: FieldErrors<T>;
  disabled?: boolean;
};

export function TermsCheckboxList<T extends FieldValues & TermsConsentsField>({
  terms,
  control,
  setValue,
  errors,
  disabled = false,
}: TermsCheckboxListProps<T>) {
  const { t } = useTranslation();
  const [modalTerm, setModalTerm] = useState<TermItem | null>(null);

  const termsConsents = useWatch({
    control,
    name: 'termsConsents' as Path<T>,
  }) as Record<string, boolean> | undefined;

  const handleAllChange = (checked: boolean) => {
    for (const term of terms) {
      setValue(
        `termsConsents.${term.id}` as Path<T>,
        checked as PathValue<T, Path<T>>,
        { shouldValidate: true },
      );
    }
  };

  const allChecked = terms.every((term) => termsConsents?.[term.id]);

  const hasOptionalTerms = terms.some((term) => !term.required);

  const termsConsentsErrors = errors?.termsConsents as
    | Record<string, { message?: string }>
    | undefined;

  const getTermTitle = (term: TermItem) => {
    if (term.title !== term.id) {
      return term.title;
    }

    return humanizeTermId(term.id);
  };

  return (
    <>
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural terms list; all labels and errors use TRText. */}
      <div className="space-y-tinyrack-xs">
        {terms.length > 1 && (
          /* tinyrack-check-ignore-next-line components/no-native-text -- Structural checkbox row containing DS controls and TRText. */
          <div className="flex cursor-pointer items-center gap-tinyrack-sm py-tinyrack-2xs">
            <TRCheckbox.Root
              aria-labelledby="terms-all-label"
              checked={allChecked}
              data-testid="terms-checkbox"
              disabled={disabled}
              onCheckedChange={handleAllChange}
              uiSize="lg"
            >
              <TRCheckbox.Indicator />
            </TRCheckbox.Root>
            <TRText id="terms-all-label" variant="caption" weight="medium">
              {t('terms.agreeAll')}
            </TRText>
            {hasOptionalTerms && (
              <TRText color="muted" variant="caption">
                {t('terms.agreeAllOptionalIncluded')}
              </TRText>
            )}
          </div>
        )}

        {terms.map((term) => (
          <Controller
            control={control}
            key={term.id}
            name={`termsConsents.${term.id}` as Path<T>}
            render={({ field }) => (
              /* tinyrack-check-ignore-next-line components/no-native-text -- Structural term state wrapper. */
              <div>
                {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural term row containing DS controls and TRText. */}
                <div className="flex items-center gap-tinyrack-sm py-tinyrack-2xs">
                  {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural label group. */}
                  <div className="flex min-w-0 flex-1 items-center gap-tinyrack-sm">
                    <TRCheckbox.Root
                      aria-labelledby={`term-label-${term.id}`}
                      checked={field.value === true}
                      data-testid="terms-checkbox"
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      uiSize="lg"
                    >
                      <TRCheckbox.Indicator />
                    </TRCheckbox.Root>
                    <TRText
                      id={`term-label-${term.id}`}
                      truncate
                      variant="caption"
                    >
                      {getTermTitle(term)}
                    </TRText>
                    <TRBadge
                      data-testid={
                        term.required
                          ? 'terms-badge-required'
                          : 'terms-badge-optional'
                      }
                      uiSize="md"
                      variant={term.required ? 'danger' : 'neutral'}
                    >
                      {term.required
                        ? t('terms.required')
                        : t('terms.optional')}
                    </TRBadge>
                  </div>
                  {term.type === 'link' && term.content && (
                    <TRLink
                      aria-label={t('terms.viewSpecific', {
                        title: getTermTitle(term),
                      })}
                      className="shrink-0 text-tinyrack-xs"
                      href={term.content}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {t('terms.view')}
                    </TRLink>
                  )}
                  {term.type === 'text' && term.content && (
                    <TRButton
                      appearance="ghost"
                      aria-label={t('terms.viewSpecific', {
                        title: getTermTitle(term),
                      })}
                      className="shrink-0 text-tinyrack-xs"
                      onClick={() => setModalTerm(term)}
                      type="button"
                      uiSize="sm"
                    >
                      {t('terms.view')}
                    </TRButton>
                  )}
                </div>
                {term.userConsent?.requiresUpdate && (
                  <TRText
                    as="p"
                    className="ml-tinyrack-xl"
                    color="warning"
                    variant="caption"
                  >
                    {t('terms.versionUpdated')}
                  </TRText>
                )}
                {termsConsentsErrors?.[term.id] && (
                  <TRText
                    as="p"
                    className="ml-tinyrack-xl"
                    color="danger"
                    data-testid="terms-field-error"
                    variant="caption"
                  >
                    {termsConsentsErrors[term.id]?.message}
                  </TRText>
                )}
              </div>
            )}
          />
        ))}
      </div>

      <TermsContentModal
        content={modalTerm?.content ?? ''}
        isOpen={modalTerm !== null}
        onClose={() => setModalTerm(null)}
        title={modalTerm?.title ?? ''}
      />
    </>
  );
}

function humanizeTermId(id: string): string {
  const words = id
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(' ')
    .filter((word) => word.length > 0);

  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
