import type { Page } from '@playwright/test';

/**
 * WebAuthn authenticator options for virtual authenticator
 */
export type VirtualAuthenticatorOptions = {
  protocol: 'ctap1/u2f' | 'ctap2';
  transport: 'usb' | 'nfc' | 'ble' | 'internal';
  hasResidentKey: boolean;
  hasUserVerification: boolean;
  isUserVerified: boolean;
  automaticPresenceSimulation?: boolean;
};

/**
 * Default options for a virtual authenticator that supports passkeys
 */
const DEFAULT_AUTHENTICATOR_OPTIONS: VirtualAuthenticatorOptions = {
  protocol: 'ctap2',
  transport: 'internal',
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true,
};

/**
 * WebAuthn mock utility for e2e testing
 *
 * Uses Playwright's Chromium CDP protocol to create virtual authenticators
 * for testing WebAuthn/Passkey flows without physical security keys.
 */
export class WebAuthnMock {
  private cdpSession: Awaited<ReturnType<typeof this.getCdpSession>> | null =
    null;
  private authenticatorId: string | null = null;

  constructor(private page: Page) {}

  /**
   * Get CDP session for the page
   */
  private async getCdpSession() {
    return this.page.context().newCDPSession(this.page);
  }

  /**
   * Enable WebAuthn virtual environment and add a virtual authenticator
   */
  async setup(
    options: Partial<VirtualAuthenticatorOptions> = {},
  ): Promise<void> {
    const authenticatorOptions = {
      ...DEFAULT_AUTHENTICATOR_OPTIONS,
      ...options,
    };

    this.cdpSession = await this.getCdpSession();

    // Enable WebAuthn environment
    await this.cdpSession.send('WebAuthn.enable');

    // Add virtual authenticator
    const result = await this.cdpSession.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: authenticatorOptions,
      },
    );

    this.authenticatorId = result.authenticatorId;
  }

  /**
   * Remove the virtual authenticator and disable WebAuthn environment
   */
  async teardown(): Promise<void> {
    if (this.cdpSession && this.authenticatorId) {
      try {
        await this.cdpSession.send('WebAuthn.removeVirtualAuthenticator', {
          authenticatorId: this.authenticatorId,
        });
      } catch {
        // Ignore errors during teardown
      }

      try {
        await this.cdpSession.send('WebAuthn.disable');
      } catch {
        // Ignore errors during teardown
      }
    }

    this.cdpSession = null;
    this.authenticatorId = null;
  }

  /**
   * Get the list of credentials registered with the virtual authenticator
   */
  async getCredentials(): Promise<
    Array<{
      credentialId: string;
      isResidentCredential: boolean;
      rpId: string;
      userHandle: string;
      signCount: number;
    }>
  > {
    if (!this.cdpSession || !this.authenticatorId) {
      throw new Error('WebAuthn mock not initialized. Call setup() first.');
    }

    const result = await this.cdpSession.send('WebAuthn.getCredentials', {
      authenticatorId: this.authenticatorId,
    });

    return result.credentials;
  }

  /**
   * Clear all credentials from the virtual authenticator
   */
  async clearCredentials(): Promise<void> {
    if (!this.cdpSession || !this.authenticatorId) {
      throw new Error('WebAuthn mock not initialized. Call setup() first.');
    }

    await this.cdpSession.send('WebAuthn.clearCredentials', {
      authenticatorId: this.authenticatorId,
    });
  }

  /**
   * Set whether user verification succeeds
   */
  async setUserVerified(isUserVerified: boolean): Promise<void> {
    if (!this.cdpSession || !this.authenticatorId) {
      throw new Error('WebAuthn mock not initialized. Call setup() first.');
    }

    await this.cdpSession.send('WebAuthn.setUserVerified', {
      authenticatorId: this.authenticatorId,
      isUserVerified,
    });
  }

  /**
   * Set whether automatic presence simulation is enabled
   */
  async setAutomaticPresenceSimulation(enabled: boolean): Promise<void> {
    if (!this.cdpSession || !this.authenticatorId) {
      throw new Error('WebAuthn mock not initialized. Call setup() first.');
    }

    await this.cdpSession.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId: this.authenticatorId,
      enabled,
    });
  }

  /**
   * Check if the mock is initialized
   */
  isInitialized(): boolean {
    return this.cdpSession !== null && this.authenticatorId !== null;
  }

  /**
   * Get the authenticator ID
   */
  getAuthenticatorId(): string | null {
    return this.authenticatorId;
  }
}

/**
 * Create a WebAuthn mock instance for a page
 */
export function createWebAuthnMock(page: Page): WebAuthnMock {
  return new WebAuthnMock(page);
}
