import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  IdentificationCardIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
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
    <div className="rounded-xl border border-base-200 bg-base-100">
      <div className="border-base-200 border-b p-4">
        <h2 className="font-semibold">{t('profile.account.title')}</h2>
        <p className="text-base-content/60 text-sm">
          {t('profile.account.description')}
        </p>
      </div>
      <div className="divide-y divide-base-200">
        {/* User ID */}
        <div className="flex items-center gap-4 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-base-200">
            <IdentificationCardIcon
              className="size-5 text-base-content/70"
              weight="regular"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base-content/60 text-xs">
              {t('profile.id.label')}
            </div>
            <div className="truncate font-medium text-sm">{user.id}</div>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center gap-4 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-base-200">
            <EnvelopeSimpleIcon
              className="size-5 text-base-content/70"
              weight="regular"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base-content/60 text-xs">
              {t('profile.email.label')}
            </div>
            <div className="truncate font-medium text-sm">{user.email}</div>
          </div>
        </div>

        {/* Email Verified */}
        <div className="flex items-center gap-4 p-4">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              user.email_verified ? 'bg-success/10' : 'bg-error/10'
            }`}
          >
            {user.email_verified ? (
              <CheckCircleIcon
                className="size-5 text-success"
                weight="regular"
              />
            ) : (
              <XCircleIcon className="size-5 text-error" weight="regular" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base-content/60 text-xs">
              {t('profile.verified.label')}
            </div>
            <div
              className={`font-medium text-sm ${
                user.email_verified ? 'text-success' : 'text-error'
              }`}
            >
              {user.email_verified
                ? t('profile.verified.yes')
                : t('profile.verified.no')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
