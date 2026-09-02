import { redirect } from 'react-router';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import type { Route } from './+types/route.js';

export function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  throw redirect(runtime.session.user ? '/profile' : '/login');
}

export default function Index() {
  return null;
}
