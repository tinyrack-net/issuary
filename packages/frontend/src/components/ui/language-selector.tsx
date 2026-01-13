import { GlobeSimpleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language';

const LANGUAGE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

type LanguageSelectorProps = {
  className?: string;
};

export function LanguageSelector({
  className = 'absolute end-4 bottom-4',
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { language, languages, setLanguage, showLanguageSelector } =
    useLanguage();

  if (!showLanguageSelector) {
    return null;
  }

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
      <ul className="menu dropdown-content z-[1] mb-2 w-40 rounded-box bg-base-100 p-2 shadow">
        {languages.map((lang) => (
          <li key={lang}>
            <button
              type="button"
              className={language === lang ? 'active' : ''}
              onClick={() => setLanguage(lang)}
            >
              {LANGUAGE_LABELS[lang] || lang}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
