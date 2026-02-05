import { Button, Heading, Link, Section, Text } from '@react-email/components';
import type { Locale } from '@/lib/locale.js';
import { EmailLayout } from '../components/email-layout.js';
import { getTranslations } from '../i18n/index.js';

export interface VerificationEmailProps {
  verificationUrl: string;
  token: string;
  locale?: Locale | undefined;
  appName?: string | undefined;
}

export const VerificationEmail = ({
  verificationUrl,
  token,
  locale = 'en',
  appName = 'TinyAuth',
}: VerificationEmailProps) => {
  const t = getTranslations(locale).verification;

  return (
    <EmailLayout preview={t.title} appName={appName}>
      <Heading className="m-0 mb-4 font-bold text-2xl text-neutral-800">
        {t.title}
      </Heading>

      <Text className="m-0 mb-2 text-base text-neutral-600">{t.greeting}</Text>
      <Text className="m-0 mb-6 text-base text-neutral-600">
        {t.description}
      </Text>

      <Section className="my-6 text-center">
        <Button
          href={verificationUrl}
          className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white"
        >
          {t.buttonText}
        </Button>
      </Section>

      <Text className="m-0 mb-2 text-neutral-500 text-sm">{t.linkAlt}</Text>
      <Link
        href={verificationUrl}
        className="mb-6 block break-all text-blue-600 text-sm"
      >
        {verificationUrl}
      </Link>

      <Text className="m-0 mb-2 text-neutral-600 text-sm">{t.codeLabel}</Text>
      <Section className="mb-6 rounded-md bg-neutral-100 p-4 text-center">
        <Text className="m-0 font-mono text-lg text-neutral-800">{token}</Text>
      </Section>

      <Text className="m-0 mb-4 text-red-600 text-sm">{t.expiry}</Text>
      <Text className="m-0 text-neutral-500 text-xs">{t.ignore}</Text>
    </EmailLayout>
  );
};

export default VerificationEmail;
