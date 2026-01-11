type PageHeaderProps = {
  title: string;
  subtitle: string;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className="mb-2 text-center font-bold text-3xl">{title}</h1>
      <p className="mb-6 text-center text-base-content/60 text-xs">
        {subtitle}
      </p>
    </div>
  );
}
