import { redirect } from 'next/navigation';
import { clearTokens } from '@/lib/token-storage';

export async function GET() {
  // Clear tokens from cookies
  await clearTokens();

  // Redirect to home page
  redirect('/');
}
