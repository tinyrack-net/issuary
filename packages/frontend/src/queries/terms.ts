import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { queryKeys } from './keys';

export type TermsResponse = InferResponseType<
  (typeof api.api.v1.terms)['$get'],
  200
>;

export type TermItem = TermsResponse['terms'][number];
export type TermsUserConsent = NonNullable<TermItem['userConsent']>;
export type TermsContentType = TermItem['type'];

/**
 * Get terms query options
 */
export const getTermsQueryOptions = (lang?: string) =>
  queryOptions({
    queryKey: queryKeys.terms(lang),
    queryFn: async () => {
      const res = await api.api.v1.terms.$get({
        query: { lang: lang ?? 'en' },
      });
      return jsonOk(res);
    },
  });

/**
 * Consent decision for a term
 */
export type TermsConsentItem = InferRequestType<
  (typeof api.api.v1.terms.consent)['$post']
>['json']['consents'][number];

/**
 * Terms consent request
 */
export type TermsConsentRequest = InferRequestType<
  (typeof api.api.v1.terms.consent)['$post']
>['json'];

/**
 * Terms consent response
 */
export type TermsConsentResponse = InferResponseType<
  (typeof api.api.v1.terms.consent)['$post'],
  200
>;

/**
 * Submit terms consent mutation
 */
export const termsConsentMutationOptions = mutationOptions({
  mutationFn: async (params: TermsConsentRequest) => {
    const res = await api.api.v1.terms.consent.$post({
      json: params,
    });
    return jsonOk(res);
  },
});
