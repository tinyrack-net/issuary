import type { APIRequestContext } from '@playwright/test';

/**
 * API base URL for direct API calls
 */
const API_BASE_URL = 'http://localhost:8080';

/**
 * Terms item type from the API
 */
export type TermsItem = {
  id: string;
  required: boolean;
  consentMode: 'explicit' | 'implicit';
  version: string;
  content: {
    title: string;
    type: 'link' | 'text';
    content: string;
  };
};

/**
 * Terms response from the API
 */
export type TermsResponse = {
  terms: TermsItem[];
};

/**
 * Session user type from the API
 */
export type SessionUser = {
  id: string;
  managed_by: 'config' | 'database';
  email: string;
  email_verified: boolean;
  email_verification_required: boolean;
  has_password: boolean;
  totp_registered: boolean;
  second_factor_required: boolean;
  passkey_count: number;
};

/**
 * API response types
 */
export type AuthResponse = {
  user?: SessionUser;
};

export type LoginResponse = {
  user: SessionUser;
};

export type RegisterResponse = {
  user: SessionUser;
};

/**
 * API helper class for direct API interactions in e2e tests
 */
export class ApiHelpers {
  constructor(private request: APIRequestContext) {}

  /**
   * Fetch terms configuration from the API
   */
  async getTerms(lang = 'en'): Promise<TermsResponse> {
    const response = await this.request.get(
      `${API_BASE_URL}/api/v1/terms?lang=${lang}`,
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Get terms failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Generate default consents for all required explicit terms
   */
  async generateRequiredConsents(): Promise<
    Array<{ termsId: string; agreed: boolean }>
  > {
    const termsData = await this.getTerms();
    return termsData.terms
      .filter((term) => term.consentMode === 'explicit')
      .map((term) => ({
        termsId: term.id,
        agreed: term.required, // Agree to required terms, leave optional as false
      }));
  }

  /**
   * Register a new user via API
   * If consents is not provided, automatically fetches and agrees to required terms
   */
  async register(
    email: string,
    password: string,
    consents?: Array<{ termsId: string; agreed: boolean }>,
  ): Promise<RegisterResponse> {
    // Auto-generate consents if not provided
    const finalConsents = consents ?? (await this.generateRequiredConsents());

    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/register`,
      {
        data: { email, password, consents: finalConsents },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Registration failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Login a user via API
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/login`,
      {
        data: { email, password },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Login failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Logout the current user via API
   */
  async logout(): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/logout`,
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Logout failed: ${response.status()} - ${error}`);
    }
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<AuthResponse> {
    const response = await this.request.get(
      `${API_BASE_URL}/api/v1/user/session`,
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Get session failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/password/forgot`,
      {
        data: { email },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `Forgot password failed: ${response.status()} - ${error}`,
      );
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/password/reset`,
      {
        data: { token, password },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Reset password failed: ${response.status()} - ${error}`);
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/verify-email`,
      {
        data: { token },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `Email verification failed: ${response.status()} - ${error}`,
      );
    }

    return response.json();
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/verify-email/resend`,
      {
        data: { email },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `Resend verification failed: ${response.status()} - ${error}`,
      );
    }
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTotpLogin(code: string): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/auth/totp/verify-login`,
      {
        data: { code },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `TOTP verification failed: ${response.status()} - ${error}`,
      );
    }

    return response.json();
  }

  /**
   * Start TOTP setup
   */
  async setupTotp(): Promise<{ secret: string; qr_code: string }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/totp/setup`,
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`TOTP setup failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Verify TOTP setup code
   */
  async verifyTotpSetup(code: string): Promise<{ recovery_codes: string[] }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/totp/verify`,
      {
        data: { code },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `TOTP setup verification failed: ${response.status()} - ${error}`,
      );
    }

    return response.json();
  }

  /**
   * Confirm TOTP setup (after saving recovery codes)
   */
  async confirmTotpSetup(): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/totp/confirm`,
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`TOTP confirm failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Disable TOTP
   */
  async disableTotp(password: string): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/totp/disable`,
      {
        data: { password },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`TOTP disable failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/password/change`,
      {
        data: { current_password: currentPassword, new_password: newPassword },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `Change password failed: ${response.status()} - ${error}`,
      );
    }
  }

  /**
   * Set password (for users without password)
   */
  async setPassword(password: string): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/password/set`,
      {
        data: { password },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Set password failed: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Remove password
   */
  async removePassword(password: string): Promise<{ user: SessionUser }> {
    const response = await this.request.post(
      `${API_BASE_URL}/api/v1/user/password/remove`,
      {
        data: { password },
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(
        `Remove password failed: ${response.status()} - ${error}`,
      );
    }

    return response.json();
  }

  /**
   * Delete account
   */
  async deleteAccount(password?: string): Promise<void> {
    const response = await this.request.delete(
      `${API_BASE_URL}/api/v1/user/account`,
      {
        data: password ? { password } : undefined,
      },
    );

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Delete account failed: ${response.status()} - ${error}`);
    }
  }
}

/**
 * Create an API helpers instance
 */
export function createApiHelpers(request: APIRequestContext): ApiHelpers {
  return new ApiHelpers(request);
}
