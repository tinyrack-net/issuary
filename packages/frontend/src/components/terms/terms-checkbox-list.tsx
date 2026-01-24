import { ArrowSquareOut as ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { TermItem } from '@/queries/terms';

type TermsCheckboxListProps = {
  terms: TermItem[];
  values: Record<string, boolean>;
  onChange: (termsId: string, agreed: boolean) => void;
  disabled?: boolean;
};

export function TermsCheckboxList({
  terms,
  values,
  onChange,
  disabled = false,
}: TermsCheckboxListProps) {
  const { t } = useTranslation();

  const handleAllRequiredChange = (checked: boolean) => {
    for (const term of terms.filter((term) => term.required)) {
      onChange(term.id, checked);
    }
  };

  const allRequiredChecked = terms
    .filter((term) => term.required)
    .every((term) => values[term.id]);

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
        <label
          key={term.id}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:bg-base-200/30"
        >
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-0.5"
            checked={values[term.id] ?? false}
            onChange={(e) => onChange(term.id, e.target.checked)}
            disabled={disabled}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`badge badge-sm ${term.required ? 'badge-error' : 'badge-ghost'}`}
              >
                {term.required ? t('terms.required') : t('terms.optional')}
              </span>
              <span className="font-medium text-sm">{term.title}</span>
              {term.url && (
                <a
                  href={term.url}
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
      ))}
    </div>
  );
}
