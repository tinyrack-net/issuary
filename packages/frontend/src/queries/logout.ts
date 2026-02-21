import { client, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';

export const logoutMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await client.api.auth.logout.$post();
    return jsonOk(res);
  },
});
