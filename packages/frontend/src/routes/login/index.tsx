import {
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { tick } from '@/libs/promise';
import { loginMutationOptions } from '@/queries/login';
import { getSessionQueryOptions } from '@/queries/session';

export const SearchSchema = z.object({
  query: z.string().optional(),
});

export const Route = createFileRoute('/login/')({
  component: Login,
  validateSearch: SearchSchema,
});

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function Login() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginMutation = useMutation({
    ...loginMutationOptions,
    onSuccess: async (data) => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, {
        user: data.user,
      });
      await tick();
      router.navigate({
        to: '/profile',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey
      });
    }
  });

  const form = useForm<LoginFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      email: 'admin@example.com',
      password: 'changemelater',
    },
    validate: zodResolver(loginSchema),
  });

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      console.log('Login attempt:', values);
      await loginMutation.mutateAsync(values);
    } catch (error) {
      console.error('Login failed:', error);
      form.setFieldError(
        'email',
        error instanceof Error ? error.message : '로그인에 실패했습니다.',
      );
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" fw={900}>
        Welcome back!
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="이메일"
              placeholder="hello@mantine.dev"
              required
              key={form.key('email')}
              {...form.getInputProps('email')}
            />

            <PasswordInput
              label="비밀번호"
              placeholder="비밀번호를 입력하세요"
              required
              mt="md"
              key={form.key('password')}
              {...form.getInputProps('password')}
            />

            <Button
              type="submit"
              fullWidth
              mt="xl"
              loading={loginMutation.isPending}
            >
              로그인
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
