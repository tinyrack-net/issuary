import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
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
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  const { register, setError, handleSubmit } = useForm<LoginFormValues>({
    defaultValues: {
      email: 'admin@example.com',
      password: 'changemelater',
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      console.log('Login attempt:', values);
      await loginMutation.mutateAsync(values);
    } catch (error) {
      console.error('Login failed:', error);
      setError('email', {
        type: 'manual',
        message: '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.',
      });
    }
  };

  return (
    <div>
      <h1>Welcome back!</h1>

      <div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <input
              type="email"
              placeholder="hello@mantine.dev"
              required
              {...register('email')}
            />

            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              required
              {...register('password')}
            />

            <button type="submit">로그인</button>
          </div>
        </form>
      </div>
    </div>
  );
}
