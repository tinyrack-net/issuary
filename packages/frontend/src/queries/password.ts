import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export type SuccessResponse = {
  success: boolean;
};

/**
 * Set password for OAuth-only users
 */
export type SetPasswordParams = {
  password: string;
};

export const setPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: SetPasswordParams) => {
    const res = await etch('/api/v1/user/password', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as SuccessResponse;
  },
});

/**
 * Change password for users who already have a password
 */
export type ChangePasswordParams = {
  current_password: string;
  new_password: string;
};

export const changePasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ChangePasswordParams) => {
    const res = await etch('/api/v1/user/password', {
      method: 'PUT',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as SuccessResponse;
  },
});

/**
 * Remove password (only if user has at least one OAuth account linked)
 */
export type RemovePasswordParams = {
  current_password: string;
};

export const removePasswordMutationOptions = mutationOptions({
  mutationFn: async (values: RemovePasswordParams) => {
    const res = await etch('/api/v1/user/password', {
      method: 'DELETE',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as SuccessResponse;
  },
});
