import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import { queryKeys } from './keys';

export type ConsentInfoParams = {
  client_id: string;
  scope?: string;
};

export type ConsentScope = {
  name: string;
  description: string;
};

export type ConsentInfoResponse = {
  client: {
    id: string;
    clientId: string;
    name: string;
  };
  scopes: ConsentScope[];
  user: {
    id: string;
    email: string;
  };
};

export const getConsentInfoQueryOptions = (params: ConsentInfoParams) =>
  queryOptions({
    queryKey: queryKeys.consent(params.client_id, params.scope),
    queryFn: async () => {
      const url = new URL('/api/v1/consent', window.location.origin);
      url.searchParams.set('client_id', params.client_id);
      if (params.scope) {
        url.searchParams.set('scope', params.scope);
      }

      const res = await etch(url.toString());
      const data = await res.json();
      return data as ConsentInfoResponse;
    },
  });

export type ConsentDecisionParams = {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain';
  decision: 'allow' | 'deny';
};

export type ConsentDecisionResponse = {
  redirect_url: string;
};

export const consentDecisionMutationOptions = mutationOptions({
  mutationFn: async (params: ConsentDecisionParams) => {
    const res = await etch('/api/v1/consent', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data as ConsentDecisionResponse;
  },
});
