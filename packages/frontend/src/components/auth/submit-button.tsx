import { TRButton } from '@tinyrack/ui/components/button';
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
    <TRButton
      className={`w-full font-semibold ${className}`}
      disabled={isPending || disabled}
      intent="primary"
      loading={isPending}
      loadingLabel={pendingText}
      type="submit"
    >
      {children}
    </TRButton>
  );
}
