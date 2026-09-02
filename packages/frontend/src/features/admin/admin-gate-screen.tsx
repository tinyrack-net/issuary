import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { PowerOffIcon, ShieldOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';

type AdminGateScreenProps = {
  /**
   * `access-required` is a refusal — this account may not be here.
   * `console-disabled` is not a failure, it is how the deployment is
   * configured, which is why the two carry different tones.
   */
  reason: 'access-required' | 'console-disabled';
};

/**
 * The screen behind both admin gates.
 *
 * These were three near-identical centred cards that had already drifted apart
 * (one used a raw `text-2xl`, another the token). There is nothing to do on any
 * of them but read a sentence and leave, which is exactly the terminal-state
 * composition `/error` uses.
 */
export function AdminGateScreen({ reason }: AdminGateScreenProps) {
  const { t } = useTranslation();

  const copy =
    reason === 'access-required'
      ? {
          icon: ShieldOffIcon,
          tone: 'danger' as const,
          title: t('admin.accessRequired'),
          description: t('admin.accessRequiredDescription'),
        }
      : {
          icon: PowerOffIcon,
          tone: 'info' as const,
          title: t('admin.disabled'),
          description: t('admin.disabledDescription'),
        };

  return (
    <AuthLayout>
      <AuthOutcome
        description={copy.description}
        icon={copy.icon}
        title={copy.title}
        tone={copy.tone}
      >
        <TRLinkButton
          className="w-full"
          intent="primary"
          render={<Link to="/profile" />}
          uiSize="lg"
        >
          {t('profile.title')}
        </TRLinkButton>
      </AuthOutcome>
    </AuthLayout>
  );
}
