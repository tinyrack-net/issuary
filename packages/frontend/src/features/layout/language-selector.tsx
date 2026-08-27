import { TRSelect } from '@tinyrack/ui/components/select';
import { CheckIcon, ChevronDownIcon, LanguagesIcon } from 'lucide-react';
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

  const options = [
    { label: autoLabel, value: 'auto' },
    ...languages.map((lang) => ({
      label: LANGUAGE_LABELS[lang] || lang,
      value: lang,
    })),
  ];

  const currentValue = isAutoMode ? 'auto' : language;

  return (
    <div className={className}>
      <TRSelect.Root
        items={options}
        onValueChange={(value) => {
          if (typeof value !== 'string') {
            return;
          }
          if (value === 'auto') {
            setAutoLanguage();
          } else {
            setLanguage(value);
          }
        }}
        value={currentValue}
      >
        {/*
          The trigger's visible content is the current value, which the
          combobox role does not expose as its own name, so without this the
          control announces as an unnamed button.
        */}
        <TRSelect.Trigger
          appearance="ghost"
          aria-label={t('common.language.select')}
          data-testid="language-selector"
          uiSize="sm"
        >
          <LanguagesIcon aria-hidden className="size-tinyrack-lg" />
          <TRSelect.Value />
          <TRSelect.Icon>
            <ChevronDownIcon aria-hidden />
          </TRSelect.Icon>
        </TRSelect.Trigger>
        <TRSelect.Portal>
          <TRSelect.Positioner>
            <TRSelect.Popup>
              <TRSelect.List>
                {options.map((option) => (
                  <TRSelect.Item key={option.value} value={option.value}>
                    <TRSelect.ItemText>{option.label}</TRSelect.ItemText>
                    <TRSelect.ItemIndicator>
                      <CheckIcon aria-hidden />
                    </TRSelect.ItemIndicator>
                  </TRSelect.Item>
                ))}
              </TRSelect.List>
            </TRSelect.Popup>
          </TRSelect.Positioner>
        </TRSelect.Portal>
      </TRSelect.Root>
    </div>
  );
}
