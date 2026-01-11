import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export const GET_SESSION_QUERY_KEY = ['/api/v1/user/session'];

export type SessionUser = {
  id: string;
  email: string;
  email_verified: boolean;
  has_password: boolean;
};

export type SessionResponse = {
  user: SessionUser | null;
};

export const getSessionQueryOptions = queryOptions({
  queryKey: GET_SESSION_QUERY_KEY,
  queryFn: async () => {
    const response = await etch('/api/v1/user/session');
    return response.json() as Promise<SessionResponse>;
  },
});
