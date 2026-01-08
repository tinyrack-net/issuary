import { zodResolver } from '@hookform/resolvers/zod';
import { Check, MoonIcon, PaintBrushIcon, SunIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTheme } from '@/hooks/use-theme';
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
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function Login() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, themes, setTheme, toggleDarkMode } = useTheme();

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

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
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
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <div className="w-full max-w-md">
        {/* Theme Controls */}
        <div className="mb-6 flex justify-end gap-2">
          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="btn btn-circle btn-ghost"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? (
              <SunIcon size={24} weight="regular" />
            ) : (
              <MoonIcon size={24} weight="regular" />
            )}
          </button>

          {/* Theme Selector Dropdown */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-circle btn-ghost"
              aria-label="Select theme"
            >
              <PaintBrushIcon size={24} weight="regular" />
            </button>
            <ul className="menu dropdown-content z-[1] max-h-96 w-52 overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg">
              {themes.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => setTheme(t)}
                    className={theme === t ? 'active' : ''}
                  >
                    <span className="capitalize">{t}</span>
                    {theme === t && <Check size={20} weight="bold" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Login Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-2 justify-center font-bold text-3xl">
              Welcome back!
            </h2>
            <p className="mb-6 text-center text-base-content/60">
              로그인하여 계속 진행하세요
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Input */}
              <div className="form-control">
                <label htmlFor="email" className="label">
                  <span className="label-text font-medium">이메일</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="hello@example.com"
                  className={`input input-bordered w-full ${
                    errors.email ? 'input-error' : ''
                  }`}
                  {...register('email')}
                />
                {errors.email && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.email.message}
                    </span>
                  </div>
                )}
              </div>

              {/* Password Input */}
              <div className="form-control">
                <label htmlFor="password" className="label">
                  <span className="label-text font-medium">비밀번호</span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  className={`input input-bordered w-full ${
                    errors.password ? 'input-error' : ''
                  }`}
                  {...register('password')}
                />
                {errors.password && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      {errors.password.message}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="form-control mt-6">
                <button
                  type="submit"
                  className={`btn btn-primary w-full ${
                    loginMutation.isPending ? 'btn-disabled' : ''
                  }`}
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      로그인 중...
                    </>
                  ) : (
                    '로그인'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-center text-base-content/60 text-sm">
          <p>현재 테마: {theme}</p>
        </div>
      </div>
    </div>
  );
}
