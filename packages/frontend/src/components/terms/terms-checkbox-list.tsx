import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRLink } from '@tinyrack/ui/components/link';
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
      <div className="space-y-1">
        {terms.length > 1 && (
          <div className="flex cursor-pointer items-center gap-1.5 py-0.5">
            <TRCheckbox.Root
              aria-labelledby="terms-all-label"
              checked={allChecked}
              data-testid="terms-checkbox"
              disabled={disabled}
              onCheckedChange={handleAllChange}
            >
              <TRCheckbox.Indicator />
            </TRCheckbox.Root>
            <span className="font-medium text-tinyrack-xs" id="terms-all-label">
              {t('terms.agreeAll')}
            </span>
            {hasOptionalTerms && (
              <span className="text-tinyrack-text-muted text-tinyrack-xs">
                {t('terms.agreeAllOptionalIncluded')}
              </span>
            )}
          </div>
        )}

        {terms.map((term) => (
          <Controller
            control={control}
            key={term.id}
            name={`termsConsents.${term.id}` as Path<T>}
            render={({ field }) => (
              <div>
                <div className="flex items-center gap-2 py-0.5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <TRCheckbox.Root
                      aria-labelledby={`term-label-${term.id}`}
                      checked={field.value === true}
                      data-testid="terms-checkbox"
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    >
                      <TRCheckbox.Indicator />
                    </TRCheckbox.Root>
                    <span
                      className="truncate text-tinyrack-xs"
                      id={`term-label-${term.id}`}
                    >
                      {getTermTitle(term)}
                    </span>
                    <TRBadge
                      data-testid={
                        term.required
                          ? 'terms-badge-required'
                          : 'terms-badge-optional'
                      }
                      uiSize="sm"
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
                    <TRLink
                      aria-label={t('terms.viewSpecific', {
                        title: getTermTitle(term),
                      })}
                      className="shrink-0 text-tinyrack-xs"
                      onClick={() => setModalTerm(term)}
                      render={<button type="button" />}
                    >
                      {t('terms.view')}
                    </TRLink>
                  )}
                </div>
                {term.userConsent?.requiresUpdate && (
                  <p className="ml-5 text-tinyrack-warning text-tinyrack-xs">
                    {t('terms.versionUpdated')}
                  </p>
                )}
                {termsConsentsErrors?.[term.id] && (
                  <p
                    className="ml-5 text-tinyrack-danger text-tinyrack-xs"
                    data-testid="terms-field-error"
                  >
                    {termsConsentsErrors[term.id]?.message}
                  </p>
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
