import { useTranslation } from 'react-i18next';

type AccessStateProps = {
  descriptionKey: string;
  titleKey: string;
};

export function AccessState({ descriptionKey, titleKey }: AccessStateProps) {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <section className="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-warning/15 font-bold text-warning">
            !
          </div>
          <h1 className="font-bold text-2xl">{t(titleKey)}</h1>
          <p className="text-base-content/70">{t(descriptionKey)}</p>
        </div>
      </section>
    </main>
  );
}
