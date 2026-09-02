import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';
import { queryKeys } from './keys';

export type TermsResponse = InferResponseType<
  (typeof client.api.terms)['$get'],
  200
>;

export type TermItem = TermsResponse['terms'][number];
export type TermsUserConsent = NonNullable<TermItem['userConsent']>;
export type TermsContentType = TermItem['type'];

/**
 * Get terms query options
 */
export const createTermsQueryOptions = (apiClient: ApiClient, lang?: string) =>
  queryOptions({
    queryKey: queryKeys.terms(lang),
    queryFn: async () => {
      const res = await apiClient.api.terms.$get({
        query: { lang: lang ?? 'en' },
      });
      return jsonOk(res);
    },
  });

export const getTermsQueryOptions = (lang?: string) =>
  createTermsQueryOptions(client, lang);

/**
 * Consent decision for a term
 */
export type TermsConsentItem = InferRequestType<
  (typeof client.api.terms.consent)['$post']
>['json']['consents'][number];

/**
 * Terms consent request
 */
export type TermsConsentRequest = InferRequestType<
  (typeof client.api.terms.consent)['$post']
>['json'];

/**
 * Terms consent response
 */
export type TermsConsentResponse = InferResponseType<
  (typeof client.api.terms.consent)['$post'],
  200
>;

/**
 * Submit terms consent mutation
 */
export const termsConsentMutationOptions = mutationOptions({
  mutationFn: async (params: TermsConsentRequest) => {
    const res = await client.api.terms.consent.$post({
      json: params,
    });
    return jsonOk(res);
  },
});
