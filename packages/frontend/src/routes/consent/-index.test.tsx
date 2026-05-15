import { afterEach, describe, expect, test, vi } from 'vitest';
import { getConsentInfoQueryOptions } from '#frontend/queries/consent.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonSuccess,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
} from '#frontend/test-utils/route-test-utils.tsx';

const consentSearch =
  'client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid+profile+email&state=state-123&nonce=nonce-123&code_challenge=challenge-123&code_challenge_method=S256';
const consentLocation = `/consent?${consentSearch}`;

function testRedirectUrl(fragment: string) {
  const [hrefWithoutHash] = globalThis.location.href.split('#');

  return `${hrefWithoutHash}#${fragment}`;
}

const consentInfo = {
  client: {
    id: 'client-1',
    clientId: 'client-web',
    name: 'Example Client',
  },
  scopes: [
    {
      name: 'openid',
      description: 'Access your unique user identifier',
    },
    {
      name: 'profile',
      description: 'Access your profile information',
    },
    {
      name: 'email',
      description: 'Access your email address',
    },
  ],
  user: {
    sub: 'user-1',
    email: 'alice@example.com',
  },
};

function consentInfoQueryData() {
  return {
    queryKey: getConsentInfoQueryOptions({
      client_id: 'client-web',
      scope: 'openid profile email',
    }).queryKey,
    data: consentInfo,
  };
}

function seededQueryData() {
  return [appConfigQueryData(routeTestAppConfig), consentInfoQueryData()];
}

afterEach(() => {
  resetFetchMock();
});

describe('/consent', () => {
  test('displays the client, signed-in user, and requested scopes', async () => {
    const { screen } = await renderRoute({
      initialLocation: consentLocation,
      queryData: seededQueryData(),
    });

    await expect
      .element(screen.getByText('Authorization Request'))
      .toBeVisible();
    await expect
      .element(
        screen.getByText('Example Client is requesting access to your account'),
      )
      .toBeVisible();
    await expect.element(screen.getByText('alice@example.com')).toBeVisible();
    await expect
      .element(screen.getByText('Access your unique user identifier'))
      .toBeVisible();
    await expect
      .element(screen.getByText('Access your profile information'))
      .toBeVisible();
    await expect
      .element(screen.getByText('Access your email address'))
      .toBeVisible();
  });

  test('approves consent with the OAuth continuation payload and redirects', async () => {
    const { screen } = await renderRoute({
      initialLocation: consentLocation,
      queryData: seededQueryData(),
    });
    const redirectUrl = testRedirectUrl('allow-redirected');
    const fetchMock = mockJsonSuccess({
      redirect_url: redirectUrl,
    });

    await screen.getByTestId('consent-allow').click();

    await vi.waitFor(() => {
      expect(globalThis.location.href).toBe(redirectUrl);
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/consent');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual({
      client_id: 'client-web',
      redirect_uri: 'https://client.example/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'state-123',
      nonce: 'nonce-123',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
      decision: 'allow',
    });
  });

  test('denies consent with the OAuth continuation payload and redirects', async () => {
    const { screen } = await renderRoute({
      initialLocation: consentLocation,
      queryData: seededQueryData(),
    });
    const redirectUrl = testRedirectUrl('deny-redirected');
    const fetchMock = mockJsonSuccess({
      redirect_url: redirectUrl,
    });

    await screen.getByTestId('consent-deny').click();

    await vi.waitFor(() => {
      expect(globalThis.location.href).toBe(redirectUrl);
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/consent');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual({
      client_id: 'client-web',
      redirect_uri: 'https://client.example/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'state-123',
      nonce: 'nonce-123',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
      decision: 'deny',
    });
  });

  test('shows the route error state when consent details cannot be loaded', async () => {
    mockJsonError(
      {
        code: 'OAUTH_INVALID_REQUEST',
        message: 'Consent session is invalid.',
      },
      400,
    );

    const { screen } = await renderRoute({
      initialLocation: consentLocation,
    });

    await expect
      .element(screen.getByText('Consent session is invalid.'))
      .toBeVisible();
    await expect
      .element(screen.getByTestId('error-code'))
      .toHaveTextContent('OAUTH_INVALID_REQUEST');
  });
});
