import { AppConfigs } from '@/lib/config.js';

export class VerifyUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifyUserError';
  }
}

export const verifyUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const user = AppConfigs.users?.find(
    (user) => user.email === email && user.password === password,
  );
  if (!user) {
    throw new VerifyUserError('Invalid email or password');
  }
  return user;
};
