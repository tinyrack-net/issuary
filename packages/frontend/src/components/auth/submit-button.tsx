export type SubmitButtonProps = {
  isPending: boolean;
  pendingText: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({
  isPending,
  pendingText,
  children,
  className = '',
  disabled = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={`btn btn-block h-10 font-semibold text-[14px] ${className}`}
      disabled={isPending || disabled}
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
