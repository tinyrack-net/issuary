import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';

export const logoutMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.auth.logout.$post();
    return jsonOk(res);
  },
});
