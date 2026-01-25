import { ArrowSquareOut as ArrowSquareOutIcon } from '@phosphor-icons/react';
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
import type { TermItem } from '@/queries/terms.js';
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

  const termsConsents = useWatch({
    control,
    name: 'termsConsents' as Path<T>,
  }) as Record<string, boolean> | undefined;

  const handleAllRequiredChange = (checked: boolean) => {
    for (const term of terms.filter((term) => term.required)) {
      setValue(
        `termsConsents.${term.id}` as Path<T>,
        checked as PathValue<T, Path<T>>,
        { shouldValidate: true },
      );
    }
  };

  const allRequiredChecked = terms
    .filter((term) => term.required)
    .every((term) => termsConsents?.[term.id]);

  const termsConsentsErrors = errors?.termsConsents as
    | Record<string, { message?: string }>
    | undefined;

  return (
    <>
      <div className="space-y-1">
        {/* All required terms checkbox */}
        {terms.some((term) => term.required) && (
          <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-xs"
              checked={allRequiredChecked}
              onChange={(e) => handleAllRequiredChange(e.target.checked)}
              disabled={disabled}
            />
            <span className="font-medium text-xs">
              {t('terms.agreeAllRequired')}
            </span>
          </label>
        )}

        {/* Individual terms */}
        {terms.map((term) => (
          <Controller
            key={term.id}
            name={`termsConsents.${term.id}` as Path<T>}
            control={control}
            render={({ field }) => (
              <div>
                <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-xs"
                    checked={(field.value as boolean) ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={disabled}
                  />
                  <span
                    className={`badge badge-xs ${term.required ? 'badge-error' : 'badge-ghost'}`}
                  >
                    {term.required ? t('terms.required') : t('terms.optional')}
                  </span>
                  <span className="text-xs">{term.title}</span>
                  {term.type === 'link' && (
                    <a
                      href={term.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowSquareOutIcon size={12} />
                    </a>
                  )}
                  {term.type === 'text' && (
                    <button
                      type="button"
                      className="link link-primary text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setModalTerm(term);
                      }}
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
                  <p className="ml-5 text-error text-xs">
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
        isOpen={modalTerm !== null}
        onClose={() => setModalTerm(null)}
        title={modalTerm?.title ?? ''}
        content={modalTerm?.content ?? ''}
      />
    </>
  );
}
