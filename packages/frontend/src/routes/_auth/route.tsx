import { Outlet } from 'react-router';
import { AuthShell } from '#frontend/features/layout/auth-layout.tsx';

export default function AuthLayoutRoute() {
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
