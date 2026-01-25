import { CheckIcon, GlobeSimpleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language.js';
import { LANGUAGE_LABELS } from '@/i18n/index.js';

type LanguageSelectorProps = {
  className?: string;
};

export function LanguageSelector({
  className = 'absolute end-4 bottom-4',
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const {
    language,
    languages,
    setLanguage,
    setAutoLanguage,
    isAutoMode,
    detectedLanguage,
    showLanguageSelector,
  } = useLanguage();

  if (!showLanguageSelector) {
    return null;
  }

  // Build auto label with detected language name
  const detectedLanguageName =
    LANGUAGE_LABELS[detectedLanguage] || detectedLanguage;
  const autoLabel = `${t('common.language.auto')} (${detectedLanguageName})`;

  return (
    <div className={`dropdown dropdown-top dropdown-end ${className}`}>
      <button
        type="button"
        tabIndex={0}
        className="btn btn-circle btn-sm"
        aria-label={t('common.language.select')}
      >
        <GlobeSimpleIcon className="size-4" weight="fill" />
      </button>
      <ul className="menu dropdown-content z-1 mb-2 w-52 rounded-box bg-base-100 p-2 shadow">
        <li>
          <button
            type="button"
            className={`justify-between ${isAutoMode ? 'active' : ''}`}
            onClick={() => setAutoLanguage()}
          >
            {autoLabel}
            {isAutoMode && <CheckIcon className="size-4" weight="bold" />}
          </button>
        </li>
        <hr className="my-1 border-base-300" />
        {languages.map((lang) => {
          const isSelected = !isAutoMode && language === lang;
          return (
            <li key={lang}>
              <button
                type="button"
                className={`justify-between ${isSelected ? 'active' : ''}`}
                onClick={() => setLanguage(lang)}
              >
                {LANGUAGE_LABELS[lang] || lang}
                {isSelected && <CheckIcon className="size-4" weight="bold" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
