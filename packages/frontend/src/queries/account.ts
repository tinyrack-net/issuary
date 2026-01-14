import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export type AccountDeletionResponse = {
  success: boolean;
  deleted_at: string;
  permanent_deletion_at: string;
};

export const deleteAccountMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await etch('/api/v1/user', {
      method: 'DELETE',
    });
    return res.json() as Promise<AccountDeletionResponse>;
  },
});
