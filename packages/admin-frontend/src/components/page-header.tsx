import type { ReactNode } from 'react';

type PageHeaderProps = {
  action?: ReactNode;
  subtitle: string;
  title: string;
};

export function PageHeader({ action, subtitle, title }: PageHeaderProps) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h1 className="card-title text-2xl tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-base-content/65 text-sm sm:text-base">
            {subtitle}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
