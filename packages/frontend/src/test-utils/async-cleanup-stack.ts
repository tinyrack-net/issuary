export type AsyncCleanup = () => Promise<void> | void;

export class AsyncCleanupStack {
  readonly #cleanups: AsyncCleanup[] = [];

  defer(cleanup: AsyncCleanup): void {
    this.#cleanups.push(cleanup);
  }

  async dispose(): Promise<void> {
    const errors: unknown[] = [];

    for (const cleanup of this.#cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    this.#cleanups.length = 0;

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Screen Lab cleanup failed.');
    }
  }
}
