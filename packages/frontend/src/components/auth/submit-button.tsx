export type SubmitButtonProps = {
  isPending: boolean;
  pendingText: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
};

export function SubmitButton({
  isPending,
  pendingText,
  children,
  className = '',
  disabled = false,
  'data-testid': testId,
}: SubmitButtonProps) {
  return (
    <button
      className={`btn btn-block h-10 font-semibold text-[14px] ${className}`}
      data-testid={testId}
      disabled={isPending || disabled}
      type="submit"
    >
      {isPending ? (
        <>
          <span className="loading loading-spinner loading-sm" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
