import { useLanguage } from '@frontend/hooks/use-language.js';
import { LANGUAGE_LABELS } from '@frontend/i18n/index.js';
import { useTranslation } from 'react-i18next';

type LanguageSelectorProps = {
  className?: string;
};

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'auto') {
      setAutoLanguage();
    } else {
      setLanguage(value);
    }
  };

  const currentValue = isAutoMode ? 'auto' : language;

  return (
    <div className={className}>
      <select
        aria-label={t('common.language.select')}
        className="select select-ghost select-sm text-base-content/60"
        data-testid="language-selector"
        onChange={handleChange}
        value={currentValue}
      >
        <option value="auto">{autoLabel}</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABELS[lang] || lang}
          </option>
        ))}
      </select>
    </div>
  );
}
