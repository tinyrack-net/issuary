import { ArrowSquareOut as ArrowSquareOutIcon } from '@phosphor-icons/react';
import type { TermItem } from '@/queries/terms';

type TermsImplicitNoticeProps = {
  notice: string;
  terms: TermItem[];
};

export function TermsImplicitNotice({
  notice,
  terms,
}: TermsImplicitNoticeProps) {
  // Filter to required terms only for implicit notice
  const requiredTerms = terms.filter((term) => term.required);

  return (
    <div className="text-center text-base-content/60 text-xs">
      <p>{notice}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {requiredTerms.map((term, index) => (
          <span key={term.id}>
            {term.url ? (
              <a
                href={term.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {term.title}
                <ArrowSquareOutIcon size={12} />
              </a>
            ) : (
              <span>{term.title}</span>
            )}
            {index < requiredTerms.length - 1 && (
              <span className="mx-1">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
