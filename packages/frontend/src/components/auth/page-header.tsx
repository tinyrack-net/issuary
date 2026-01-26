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
          <img src={iconUrl} alt="" className="h-12 w-12 object-contain" />
        </div>
      )}
      <h1
        className={`text-center font-bold text-2xl ${
          subtitle ? 'mb-0' : 'mb-6'
        }`}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mb-6 text-center text-lg text-base-content/60">
          {subtitle}
        </p>
      )}
    </div>
  );
}
