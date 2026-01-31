import type { ReactNode } from 'react';

type LoginMethodListProps = {
  children: ReactNode;
};

export function LoginMethodList({ children }: LoginMethodListProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{children}</div>
  );
}
