import type { APIRequestContext, Page } from '@playwright/test';
import { createApiHelpers, type SessionUser } from './api-helpers';
import { generateEmail, generatePassword } from '../fixtures/test-data.fixture';

/**
 * Test user representation
 */
export type TestUser = {
  email: string;
  password: string;
  user?: SessionUser;
};

/**
 * Test user manager for creating and managing test users
 */
export class TestUserManager {
  private apiHelpers: ReturnType<typeof createApiHelpers>;
  private createdUsers: TestUser[] = [];

  constructor(request: APIRequestContext) {
    this.apiHelpers = createApiHelpers(request);
  }

  /**
   * Create a new test user with random credentials
   */
  async createUser(options?: { email?: string; password?: string }): Promise<TestUser> {
    const email = options?.email ?? generateEmail();
    const password = options?.password ?? generatePassword();

    const response = await this.apiHelpers.register(email, password);

    const testUser: TestUser = {
      email,
      password,
      user: response.user,
    };

    this.createdUsers.push(testUser);
    return testUser;
  }

  /**
   * Create a test user and log them in, returning session user data
   */
  async createAndLogin(options?: {
    email?: string;
    password?: string;
  }): Promise<TestUser> {
    const testUser = await this.createUser(options);
    const response = await this.apiHelpers.login(testUser.email, testUser.password);
    testUser.user = response.user;
    return testUser;
  }

  /**
   * Login with existing user credentials
   */
  async login(email: string, password: string): Promise<SessionUser> {
    const response = await this.apiHelpers.login(email, password);
    return response.user;
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await this.apiHelpers.logout();
  }

  /**
   * Get the current session user
   */
  async getSession(): Promise<SessionUser | undefined> {
    const response = await this.apiHelpers.getSession();
    return response.user;
  }

  /**
   * Cleanup all created test users
   * Note: This may require admin API or database access in a real implementation
   */
  async cleanup(): Promise<void> {
    // For now, we just clear the tracking list
    // In a production setup, you would call an admin API to delete users
    // or use a database cleanup mechanism
    this.createdUsers = [];
  }

  /**
   * Get all created test users
   */
  getCreatedUsers(): TestUser[] {
    return [...this.createdUsers];
  }
}

/**
 * Apply session cookies from API request to a page
 */
export async function applySessionToPage(
  request: APIRequestContext,
  page: Page
): Promise<void> {
  const cookies = await request.storageState();
  await page.context().addCookies(cookies.cookies);
}

/**
 * Create a test user manager
 */
export function createTestUserManager(request: APIRequestContext): TestUserManager {
  return new TestUserManager(request);
}

/**
 * Setup a test user and login, applying session to page
 */
export async function setupAuthenticatedUser(
  request: APIRequestContext,
  page: Page,
  options?: { email?: string; password?: string }
): Promise<TestUser> {
  const manager = createTestUserManager(request);
  const testUser = await manager.createAndLogin(options);
  await applySessionToPage(request, page);
  return testUser;
}
