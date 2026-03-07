export interface AppConfigUser {
  sub: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
}
