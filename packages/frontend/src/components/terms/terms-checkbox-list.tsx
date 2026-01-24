import { ArrowSquareOut as ArrowSquareOutIcon } from '@phosphor-icons/react';
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
    <div className="space-y-3">
      {/* All required terms checkbox */}
      {terms.some((term) => term.required) && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 bg-base-200/50 p-3">
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-0.5"
            checked={allRequiredChecked}
            onChange={(e) => handleAllRequiredChange(e.target.checked)}
            disabled={disabled}
          />
          <div className="flex-1">
            <span className="font-medium text-sm">
              {t('terms.agreeAllRequired')}
            </span>
          </div>
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
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:bg-base-200/30">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary mt-0.5"
                  checked={(field.value as boolean) ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  disabled={disabled}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge badge-sm ${term.required ? 'badge-error' : 'badge-ghost'}`}
                    >
                      {term.required
                        ? t('terms.required')
                        : t('terms.optional')}
                    </span>
                    <span className="font-medium text-sm">{term.title}</span>
                    {term.type === 'link' && (
                      <a
                        href={term.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ArrowSquareOutIcon size={16} />
                      </a>
                    )}
                  </div>
                  {term.userConsent?.requiresUpdate && (
                    <p className="mt-1 text-warning text-xs">
                      {t('terms.versionUpdated')}
                    </p>
                  )}
                </div>
              </label>
              {termsConsentsErrors?.[term.id] && (
                <p className="mt-1 ml-9 text-error text-xs">
                  {termsConsentsErrors[term.id]?.message}
                </p>
              )}
            </div>
          )}
        />
      ))}
    </div>
  );
}
