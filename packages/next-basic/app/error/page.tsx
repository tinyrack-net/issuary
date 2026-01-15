export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; description?: string }>;
}) {
  const params = await searchParams;
  const { error, description } = params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 dark:border-red-800 dark:bg-black">
        <h1 className="mb-4 font-bold text-2xl text-red-600 dark:text-red-400">
          Authentication Error
        </h1>
        <div className="mb-4 text-zinc-600 dark:text-zinc-400">
          <p className="mb-2">
            <strong>Error:</strong> {error || 'Unknown error'}
          </p>
          <p>
            <strong>Description:</strong>{' '}
            {description || 'No description available'}
          </p>
        </div>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
