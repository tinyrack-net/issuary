import { TRMeter } from '@tinyrack/ui/components/meter';
import { TRText } from '@tinyrack/ui/components/text';
import { useTranslation } from 'react-i18next';

type PasswordPolicy = {
  min_length: number;
  max_length: number;
};

type PasswordStrengthProps = {
  password: string;
  policy: PasswordPolicy;
};

const LEVELS = ['weak', 'fair', 'good', 'strong'] as const;

const VARIANTS = {
  weak: 'danger',
  fair: 'warning',
  good: 'info',
  strong: 'success',
} as const;

/**
 * Scores a password 1-4 for feedback only.
 *
 * Deliberately simple: length against the deployment's own policy plus
 * character-class variety. The server is the authority on what is acceptable,
 * so this only needs to steer the user, and a full entropy estimator would be
 * a large dependency for a hint bar.
 *
 * Returns 0 for "nothing to say yet" so the caller can stay silent.
 */
function scorePassword(password: string, policy: PasswordPolicy): number {
  if (password.length === 0) {
    return 0;
  }
  if (password.length < policy.min_length) {
    return 1;
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length;

  const isLong = password.length >= policy.min_length + 4;

  if (classes >= 3 && isLong) {
    return 4;
  }
  if (classes >= 2 && isLong) {
    return 3;
  }
  return 2;
}

/**
 * Strength hint under a new-password field.
 *
 * Renders nothing for an empty field so the form does not shift as soon as it
 * is focused. Announced politely rather than assertively — it updates on every
 * keystroke and should not interrupt typing.
 */
export function PasswordStrength({ password, policy }: PasswordStrengthProps) {
  const { t } = useTranslation();
  const score = scorePassword(password, policy);

  if (score === 0) {
    return null;
  }

  const level = LEVELS[score - 1];

  return (
    <TRMeter.Root
      aria-live="polite"
      className="flex flex-col gap-tinyrack-xs"
      max={4}
      min={0}
      value={score}
      variant={VARIANTS[level]}
    >
      <div className="flex items-baseline justify-between gap-tinyrack-sm">
        <TRMeter.Label
          render={
            <TRText color="muted" variant="caption">
              {t('validation.password.strength.label')}
            </TRText>
          }
        />
        <TRMeter.Value
          render={
            <TRText color="muted" variant="caption">
              {t(`validation.password.strength.${level}`)}
            </TRText>
          }
        />
      </div>
      <TRMeter.Track>
        <TRMeter.Indicator />
      </TRMeter.Track>
    </TRMeter.Root>
  );
}
