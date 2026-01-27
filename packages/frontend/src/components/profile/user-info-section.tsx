import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface UserInfoSectionProps {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
  };
}

export function UserInfoSection({ user }: UserInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-base-200">
      <div className="border-base-200 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{t('profile.account.title')}</h2>
        <p className="text-base-content/60 text-xs">
          {t('profile.account.description')}
        </p>
      </div>
      <div className="divide-y divide-base-200">
        {/* User ID */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-base-content/60 text-xs">
            {t('profile.id.label')}
          </span>
          <span className="truncate font-medium text-sm">{user.id}</span>
        </div>

        {/* Email */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-base-content/60 text-xs">
            {t('profile.email.label')}
          </span>
          <span className="truncate font-medium text-sm">{user.email}</span>
        </div>

        {/* Email Verified */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-base-content/60 text-xs">
            {t('profile.verified.label')}
          </span>
          <span
            className={`flex items-center gap-1.5 font-medium text-sm ${
              user.email_verified ? 'text-success' : 'text-error'
            }`}
          >
            {user.email_verified ? (
              <CheckCircleIcon className="size-4" weight="fill" />
            ) : (
              <XCircleIcon className="size-4" weight="fill" />
            )}
            {user.email_verified
              ? t('profile.verified.yes')
              : t('profile.verified.no')}
          </span>
        </div>
      </div>
    </div>
  );
}
