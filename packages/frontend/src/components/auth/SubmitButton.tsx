type SubmitButtonProps = {
  isPending: boolean;
  pendingText: string;
  children: React.ReactNode;
  className?: string;
};

export function SubmitButton({
  isPending,
  pendingText,
  children,
  className = '',
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={`btn btn-block h-10 font-semibold text-[14px] ${className}`}
      disabled={isPending}
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
