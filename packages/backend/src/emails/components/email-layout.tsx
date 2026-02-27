/** @jsxImportSource react */
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  preview: string;
  appName: string;
  children: ReactNode;
}

export const EmailLayout = ({
  preview,
  appName,
  children,
}: EmailLayoutProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Tailwind>
      <Body className="bg-neutral-100 py-8 font-sans">
        <Container className="mx-auto max-w-xl rounded-lg border border-neutral-200 bg-white p-8">
          {children}
          <Footer appName={appName} />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

interface FooterProps {
  appName: string;
}

const Footer = ({ appName }: FooterProps) => (
  <Section className="mt-8 border-neutral-200 border-t pt-6">
    <Text className="m-0 text-center text-neutral-400 text-xs">
      Powered by {appName}
    </Text>
  </Section>
);
