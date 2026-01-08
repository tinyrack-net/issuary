import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { tick } from '@/libs/promise';
import { logoutMutationOptions } from '@/queries/logout';
import { getSessionQueryOptions } from '@/queries/session';

export const Route = createFileRoute('/profile/')({
  component: Profile,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: '/login',
      });
    }
  },
});

function Profile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    ...logoutMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: null,
      });
      await tick();
      router.navigate({
        to: '/login',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey
      });
    }
  });

  return (
    <div >
      <h2>
        내 정보
      </h2>
      <div>
        <button
          type='button'
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
