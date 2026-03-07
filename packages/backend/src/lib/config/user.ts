export interface UserConfig {
  sub: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
}
