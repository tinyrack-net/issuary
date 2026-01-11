type DividerProps = {
  text?: string;
  className?: string;
};

export function Divider({ text, className = '' }: DividerProps) {
  return (
    <div className={`my-4 flex items-center ${className}`}>
      <div className="h-px flex-1 bg-base-200" />
      {text && (
        <span className="px-3 text-base-content/60 text-sm">{text}</span>
      )}
      <div className="h-px flex-1 bg-base-200" />
    </div>
  );
}
