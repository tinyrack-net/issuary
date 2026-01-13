import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  UserIcon,
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
    <div className="mb-4 rounded-lg bg-base-200 p-4">
      <div className="flex flex-col gap-3">
        {/* User ID */}
        <div className="flex items-center gap-3">
          <UserIcon className="size-5 text-primary" weight="regular" />
          <div className="flex-1">
            <div className="text-base-content/60 text-xs">
              {t('profile.id.label')}
            </div>
            <div className="truncate font-medium text-sm">{user.id}</div>
          </div>
        </div>

        <div className="h-px bg-base-300" />

        {/* Email */}
        <div className="flex items-center gap-3">
          <EnvelopeSimpleIcon
            className="size-5 text-primary"
            weight="regular"
          />
          <div className="flex-1">
            <div className="text-base-content/60 text-xs">
              {t('profile.email.label')}
            </div>
            <div className="font-medium text-sm">{user.email}</div>
          </div>
        </div>

        <div className="h-px bg-base-300" />

        {/* Email Verified */}
        <div className="flex items-center gap-3">
          {user.email_verified ? (
            <CheckCircleIcon className="size-5 text-success" weight="regular" />
          ) : (
            <XCircleIcon className="size-5 text-error" weight="regular" />
          )}
          <div className="flex-1">
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
