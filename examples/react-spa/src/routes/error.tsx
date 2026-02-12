import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
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
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-error">Error</h2>
          {error && (
            <div className="mt-2">
              <span className="badge badge-error">{error}</span>
            </div>
          )}
          {description && <p className="mt-2 text-sm">{description}</p>}
          <div className="card-actions mt-4 justify-end">
            <Link className="btn btn-primary" to="/">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
