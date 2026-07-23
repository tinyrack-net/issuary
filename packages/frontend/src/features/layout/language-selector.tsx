import type { TRLanguageSelectOption } from '@tinyrack/ui/components/language-select';
import { TRLanguageSelect } from '@tinyrack/ui/components/language-select';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '#frontend/hooks/use-language.ts';
import { LANGUAGE_LABELS } from '#frontend/i18n/index.ts';

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

  const detectedLanguageName =
    LANGUAGE_LABELS[detectedLanguage] || detectedLanguage;
  const autoLabel = `${t('common.language.auto')} (${detectedLanguageName})`;

  const options: readonly TRLanguageSelectOption[] = [
    { label: autoLabel, value: 'auto' },
    ...languages.map((lang) => ({
      label: LANGUAGE_LABELS[lang] || lang,
      value: lang,
    })),
  ];

  const handleValueChange = (value: string, _eventDetails?: unknown) => {
    if (value === 'auto') {
      setAutoLanguage();
    } else {
      setLanguage(value);
    }
  };

  const currentValue = isAutoMode ? 'auto' : language;

  return (
    <div className={className}>
      <TRLanguageSelect
        data-testid="language-selector"
        label={t('common.language.select')}
        onValueChange={handleValueChange}
        options={options}
        value={currentValue}
      />
    </div>
  );
}
