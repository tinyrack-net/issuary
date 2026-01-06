import { Button, Container, Paper, Title } from '@mantine/core';
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
    <Container size={540} my={40}>
      <Title order={2} mb="xl">
        내 정보
      </Title>
      <Paper withBorder shadow="md" p={30} radius="md">
        <Button
          loading={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          로그아웃
        </Button>
      </Paper>
    </Container>
  );
}
