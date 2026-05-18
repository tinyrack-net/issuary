type PageHeaderProps = {
  subtitle: string;
  title: string;
};

export function PageHeader({ subtitle, title }: PageHeaderProps) {
  return (
    <div>
      <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-base-content/65 text-sm sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}
