import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export type LogoutResponse = {
  ok: boolean;
};

export const logoutMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await etch(`/api/v1/user/logout`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return data as LogoutResponse;
  },
});
