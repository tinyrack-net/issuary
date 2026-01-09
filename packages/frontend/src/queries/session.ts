import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export const GET_SESSION_QUERY_KEY = ['/api/v1/user/session'];

export type SessionUser = {
  id: string;
};

export type SessionResponse = {
  user: SessionUser | null;
};

export const getSessionQueryOptions = queryOptions({
  queryKey: GET_SESSION_QUERY_KEY,
  queryFn: async () => {
    try {
      const response = await etch('/api/v1/user/session');
      return response.json() as Promise<SessionResponse>;
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        return { user: null } as SessionResponse;
      }
      throw error;
    }
  },
});
