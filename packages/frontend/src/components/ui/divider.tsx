type DividerProps = {
  text?: string;
  className?: string;
};

export function Divider({ text, className = '' }: DividerProps) {
  return (
    <div className={`my-4 flex items-center ${className}`}>
      <div className="h-px flex-1 bg-border" />
      {text && (
        <span className="px-3 text-muted-foreground text-sm">{text}</span>
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
