type PageHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={className}>
      <h1
        className={`text-center font-bold text-3xl ${subtitle ? 'mb-2' : 'mb-6'}`}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {subtitle}
        </p>
      )}
    </div>
  );
}
