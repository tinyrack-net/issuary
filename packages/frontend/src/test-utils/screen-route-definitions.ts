import * as ErrorRoute from '#frontend/routes/_auth.error/route.tsx';
import * as LoginRoute from '#frontend/routes/_auth.login_.password/route.tsx';
import * as PasswordResetRoute from '#frontend/routes/_auth.password.reset/route.tsx';
import * as RegisterRoute from '#frontend/routes/_auth.register/route.tsx';
import * as VerifyEmailRoute from '#frontend/routes/_auth.verify.email/route.tsx';
import {
  defineRouteScreen,
  type RouteScreenDefinition,
} from './route-test-fixture.tsx';

const ROUTE_SCREEN_DEFINITIONS: Readonly<
  Record<string, RouteScreenDefinition>
> = {
  'email-verification': defineRouteScreen('auth', VerifyEmailRoute),
  error: defineRouteScreen('auth', ErrorRoute),
  login: defineRouteScreen('auth', LoginRoute),
  'password-reset': defineRouteScreen('auth', PasswordResetRoute),
  register: defineRouteScreen('auth', RegisterRoute),
};

export function getRouteScreenDefinition(id: string): RouteScreenDefinition {
  const definition = ROUTE_SCREEN_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown route screen scenario: ${id}`);
  return definition;
}
