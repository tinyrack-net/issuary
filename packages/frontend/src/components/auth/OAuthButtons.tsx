type OAuthProvider = {
  name: string;
  display_name: string;
  icon_url?: string;
};

type OAuthButtonsProps = {
  providers: OAuthProvider[];
  buildUrl: (providerName: string) => string;
  className?: string;
};

export function OAuthButtons({
  providers,
  buildUrl,
  className = '',
}: OAuthButtonsProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {providers.map((provider) => (
        <a
          key={provider.name}
          href={buildUrl(provider.name)}
          className="btn border-base-300"
        >
          {provider.icon_url && (
            <img
              src={provider.icon_url}
              alt={provider.display_name}
              className="h-4 w-4"
            />
          )}
          {provider.display_name}
        </a>
      ))}
    </div>
  );
}
