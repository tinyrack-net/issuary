import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useRevalidator } from 'react-router';

type SearchSchema<TSearch> = {
  parse: (input: unknown) => TSearch;
};

export function parseRequestSearch<TSearch>(
  request: Request,
  schema: SearchSchema<TSearch>,
): TSearch {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

export function createRouteLoaderData<TSearch>(
  queryClient: QueryClient,
  search: TSearch,
) {
  return { dehydratedState: dehydrate(queryClient), search };
}

export function RouteHydrationBoundary({
  children,
  state,
}: {
  children: ReactNode;
  state: ReturnType<typeof dehydrate>;
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}

export type RouteErrorComponentProps = {
  error: Error;
  reset: () => void;
};

export function NativeRouteErrorBoundary({
  component: ErrorComponent,
  error: routeError,
}: {
  component: ComponentType<RouteErrorComponentProps>;
  error: unknown;
}) {
  const revalidator = useRevalidator();
  const error =
    routeError instanceof Error ? routeError : new Error('Unknown route error');
  return (
    <ErrorComponent error={error} reset={() => revalidator.revalidate()} />
  );
}

export function hrefWithSearch(
  to: string,
  search: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${to}?${query}` : to;
}
