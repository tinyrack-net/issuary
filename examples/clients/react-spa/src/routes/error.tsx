import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import z from 'zod';

const errorSearchSchema = z.object({
  error: z.string().optional(),
  description: z.string().optional(),
});

export const Route = createFileRoute('/error')({
  component: ErrorPage,
  validateSearch: errorSearchSchema,
});

function ErrorPage() {
  const { error, description } = useSearch({ from: '/error' });

  return (
    <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
      <TRCard.Root className="w-full max-w-tinyrack-measure-xl">
        <TRCard.Header>
          <TRCard.Title className="text-tinyrack-danger-foreground">
            Error
          </TRCard.Title>
          <TRCard.Description>
            {error && (
              <div className="mt-tinyrack-sm">
                <TRBadge variant="danger">{error}</TRBadge>
              </div>
            )}
            {description && (
              <p className="mt-tinyrack-sm text-tinyrack-sm">{description}</p>
            )}
          </TRCard.Description>
        </TRCard.Header>
        <TRCard.Footer className="justify-end">
          <TRButton intent="primary" render={<Link to="/" />}>
            Back to Home
          </TRButton>
        </TRCard.Footer>
      </TRCard.Root>
    </div>
  );
}
