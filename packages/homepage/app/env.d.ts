/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { JSX } from 'react';

  export default function MdxContent(
    props: Record<string, unknown>,
  ): JSX.Element;
}
