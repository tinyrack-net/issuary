import type { ReactNode } from 'react';

type LoginMethodListProps = {
  children: ReactNode;
};

export function LoginMethodList({ children }: LoginMethodListProps) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}
