import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { useEffect, useState } from 'react';

type HeroTypewriterProps = {
  docsLabel: string;
  docsPath: string;
  prefix?: string;
  suffix?: string;
  words: string[];
};

type TypewriterOptions = {
  onChange: (value: string) => void;
  reducedMotion: boolean;
  words: string[];
};

export function startTypewriter({
  onChange,
  reducedMotion,
  words,
}: TypewriterOptions) {
  const firstWord = words[0] ?? '';
  onChange(firstWord);
  if (reducedMotion || words.length === 0) return () => {};

  let wordIndex = 0;
  let characterIndex = firstWord.length;
  let deleting = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    const currentWord = words[wordIndex] ?? firstWord;

    if (deleting) {
      characterIndex -= 1;
      onChange(currentWord.slice(0, characterIndex));
      if (characterIndex <= 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        timeout = setTimeout(tick, 300);
        return;
      }
      timeout = setTimeout(tick, 60);
      return;
    }

    const nextWord = words[wordIndex] ?? firstWord;
    characterIndex += 1;
    onChange(nextWord.slice(0, characterIndex));
    if (characterIndex >= nextWord.length) {
      deleting = true;
      timeout = setTimeout(tick, 1_500);
      return;
    }
    timeout = setTimeout(tick, 100);
  };

  timeout = setTimeout(tick, 1_500);
  return () => {
    if (timeout !== undefined) clearTimeout(timeout);
  };
}

export function HeroTypewriter({
  docsLabel,
  docsPath,
  prefix,
  suffix,
  words,
}: HeroTypewriterProps) {
  const [word, setWord] = useState(words[0] ?? '');

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    return startTypewriter({ onChange: setWord, reducedMotion, words });
  }, [words]);

  return (
    <section className="tinyauth-home">
      <TRBadge variant="info">OpenID Connect Provider</TRBadge>
      <svg
        aria-hidden="true"
        className="tinyauth-home-mark"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
        viewBox="0 0 256 256"
      >
        <path d="M128 24 32 72v56c0 52.37 40.73 100.86 96 112 55.27-11.14 96-59.63 96-112V72Z" />
        <rect height="48" rx="4" width="64" x="96" y="112" />
        <path d="M112 112V88a16 16 0 0 1 32 0v24" />
        <circle cx="128" cy="136" fill="currentColor" r="4" stroke="none" />
      </svg>
      <h1>
        {prefix}
        <span className="tinyauth-typewriter">{word}</span>
        <span aria-hidden="true" className="tinyauth-typewriter-cursor">
          |
        </span>
        {suffix}
      </h1>
      <TRButton intent="primary" render={<a href={docsPath} />} uiSize="lg">
        {docsLabel} →
      </TRButton>
    </section>
  );
}
