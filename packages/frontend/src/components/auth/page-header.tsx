type PageHeaderProps = {
  title: string;
  subtitle?: string;
  iconUrl?: string;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  iconUrl,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={className}>
      {iconUrl && (
        <div className="mb-4 flex justify-center">
          <img alt="" className="h-12 w-12 object-contain" src={iconUrl} />
        </div>
      )}
      <h1
        className={`text-center font-bold text-tinyrack-2xl text-tinyrack-text ${
          subtitle ? 'mb-0' : 'mb-6'
        }`}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mb-6 text-center text-tinyrack-lg text-tinyrack-text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}
