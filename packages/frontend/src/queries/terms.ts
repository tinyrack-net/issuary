import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import { queryKeys } from './keys';

/**
 * User consent status for a term
 */
export type TermsUserConsent = {
  agreed: boolean;
  agreedVersion: string | null;
  agreedAt: string | null;
  consentType: 'explicit' | 'implicit' | null;
  requiresUpdate: boolean;
};

/**
 * Content type for terms content
 */
export type TermsContentType = 'link' | 'text';

/**
 * Term item with localized content
 */
export type TermItem = {
  id: string;
  required: boolean;
  consentMode: 'explicit' | 'implicit';
  version: string;
  title: string;
  type: TermsContentType;
  content: string;
  userConsent: TermsUserConsent | null;
};

/**
 * Terms response from GET /api/v1/terms
 */
export type TermsResponse = {
  implicitNotice: string | null;
  terms: TermItem[];
  pendingTerms: string[];
};

/**
 * Get terms query options
 */
export const getTermsQueryOptions = (lang?: string) =>
  queryOptions({
    queryKey: queryKeys.terms(lang),
    queryFn: async () => {
      const url = new URL('/api/v1/terms', window.location.origin);
      if (lang) {
        url.searchParams.set('lang', lang);
      }
      const res = await etch(url.toString());
      const data = await res.json();
      return data as TermsResponse;
    },
  });

/**
 * Consent decision for a term
 */
export type TermsConsentItem = {
  termsId: string;
  agreed: boolean;
  consentType?: 'explicit' | 'implicit';
};

/**
 * Terms consent request
 */
export type TermsConsentRequest = {
  consents: TermsConsentItem[];
};

/**
 * Terms consent response
 */
export type TermsConsentResponse = {
  ok: true;
  recorded: number;
};

/**
 * Submit terms consent mutation
 */
export const termsConsentMutationOptions = mutationOptions({
  mutationFn: async (params: TermsConsentRequest) => {
    const res = await etch('/api/v1/terms/consent', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data as TermsConsentResponse;
  },
});
