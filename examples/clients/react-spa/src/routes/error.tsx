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
    <div className="flex min-h-screen items-center justify-center p-4">
      <TRCard.Root className="w-full max-w-md">
        <TRCard.Header>
          <TRCard.Title className="text-red-600 dark:text-red-400">
            Error
          </TRCard.Title>
          <TRCard.Description>
            {error && (
              <div className="mt-2">
                <TRBadge variant="danger">{error}</TRBadge>
              </div>
            )}
            {description && <p className="mt-2 text-sm">{description}</p>}
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
