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
import type { TermItem } from '#frontend/queries/terms.js';
import { TermsContentModal } from './terms-content-modal.js';

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

  // react-hook-form's Path<T> cannot be narrowed from template literal
  // strings when T is generic, so these casts are necessary to bridge
  // the generic constraint with the known 'termsConsents' field shape.
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

  return (
    <>
      <div className="space-y-1">
        {/* All terms checkbox */}
        {terms.length > 1 && (
          <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
            <input
              checked={allChecked}
              className="checkbox checkbox-primary checkbox-xs"
              data-testid="terms-checkbox"
              disabled={disabled}
              onChange={(e) => handleAllChange(e.target.checked)}
              type="checkbox"
            />
            <span className="font-medium text-xs">{t('terms.agreeAll')}</span>
            {hasOptionalTerms && (
              <span className="text-base-content/50 text-xs">
                {t('terms.agreeAllOptionalIncluded')}
              </span>
            )}
          </label>
        )}

        {/* Individual terms */}
        {terms.map((term) => (
          <Controller
            control={control}
            key={term.id}
            name={`termsConsents.${term.id}` as Path<T>}
            render={({ field }) => (
              <div>
                <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
                  <input
                    checked={(field.value as boolean) ?? false}
                    className="checkbox checkbox-primary checkbox-xs"
                    data-testid="terms-checkbox"
                    disabled={disabled}
                    onChange={(e) => field.onChange(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-xs">{term.title}</span>
                  <span
                    className={`badge badge-xs ${
                      term.required ? 'badge-error' : 'badge-ghost'
                    }`}
                    data-testid={
                      term.required
                        ? 'terms-badge-required'
                        : 'terms-badge-optional'
                    }
                  >
                    {term.required ? t('terms.required') : t('terms.optional')}
                  </span>
                  {term.type === 'link' && (
                    <button
                      className="link link-primary ml-auto text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(
                          term.content,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                      type="button"
                    >
                      {t('terms.view')}
                    </button>
                  )}
                  {term.type === 'text' && (
                    <button
                      className="link link-primary ml-auto text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setModalTerm(term);
                      }}
                      type="button"
                    >
                      {t('terms.view')}
                    </button>
                  )}
                </label>
                {term.userConsent?.requiresUpdate && (
                  <p className="ml-5 text-warning text-xs">
                    {t('terms.versionUpdated')}
                  </p>
                )}
                {termsConsentsErrors?.[term.id] && (
                  <p
                    className="ml-5 text-error text-xs"
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

      {/* Modal for text type terms */}
      <TermsContentModal
        content={modalTerm?.content ?? ''}
        isOpen={modalTerm !== null}
        onClose={() => setModalTerm(null)}
        title={modalTerm?.title ?? ''}
      />
    </>
  );
}
