import { mutationOptions } from '@tanstack/react-query';
import { api, jsonOk } from '@/libs/api';

export const logoutMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.v1.auth.logout.$post();
    return jsonOk(res);
  },
});
