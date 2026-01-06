import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({
        to: '/profile',
      });
    } else {
      throw redirect({
        to: '/login',
      });
    }
  },
});

function Index() {
  return null;
}
