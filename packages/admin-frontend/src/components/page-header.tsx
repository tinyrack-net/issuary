type PageHeaderProps = {
  subtitle: string;
  title: string;
};

export function PageHeader({ subtitle, title }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="font-bold text-3xl tracking-tight">{title}</h1>
      <p className="mt-2 text-base-content/65">{subtitle}</p>
    </div>
  );
}
