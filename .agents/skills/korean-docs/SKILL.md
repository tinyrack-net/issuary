---
name: korean-docs
description: Write and revise Korean documentation for the tinyauth project, matching the existing Korean docs voice while keeping standalone, deployment, and protocol details accurate.
---

# Korean Docs Skill

Use this skill when writing or revising Korean-facing documentation in the tinyauth repository, especially homepage/docs content and standalone configuration or deployment guides.

## Goal

Produce natural Korean documentation that matches the current style of `packages/homepage/src/content/docs/ko/**` while preserving technical precision for `packages/standalone/**`, OAuth2, OIDC, frontend, backend, and deployment topics.

## Primary References

When the task touches Korean documentation, use these as the style and accuracy sources:

- Style and tone reference:
  - `packages/homepage/src/content/docs/ko/**`
- Standalone configuration truth source:
  - `packages/standalone/config.example.yaml`
- Standalone defaults and config behavior:
  - `packages/standalone/src/lib/config/**`
- If prose and code disagree, trust the current package source over older documentation wording.

## Project Context

- tinyauth is a self-hosted OpenID Connect (OIDC) authentication product.
- Main doc audiences are:
  - developers integrating OIDC into their apps
  - operators deploying tinyauth themselves
  - readers comparing auth solutions
- Standalone docs are heavily config- and deployment-oriented:
  - `config.yaml`
  - environment variables
  - Docker / Docker Compose
  - reverse proxy setup
  - SQLite / PostgreSQL choices

## Style Extracted From Current Korean Docs

### Default voice

The current Korean docs mostly use an approachable, explanatory **해요체**.

- good:
  - `Docker만 있으면 바로 시작할 수 있어요.`
  - `이 설정은 standalone 서버가 바인딩할 포트예요.`
  - `필요하다면 이 값을 명시적으로 설정하세요.`
- avoid as the default house style:
  - `시작할 수 있습니다.`
  - `설정합니다.`
  - `설정해 주십시오.`

Use a friendly documentation tone: practical, clear, and direct. It should feel like product docs written for real users, not a literal translation or a formal notice.

### Sentence and paragraph style

- Prefer short paragraphs, usually 1 to 3 sentences.
- Lead with the practical outcome, then explain why it matters.
- Prefer concrete phrasing over abstract explanation.
- Frequently use natural Korean patterns already seen in the docs, such as:
  - `...할 수 있어요`
  - `...기준이 돼요`
  - `...일 때만 적용돼요`
  - `...문서를 참고하세요`
- In step-by-step sections, direct imperative forms like `설정하세요`, `접속하세요`, `추가하세요` are acceptable.
- Do not mix stiff formal prose with casual instruction in the same section.

## Terminology And Naming

- Preserve exact technical identifiers unchanged:
  - package names
  - environment variables
  - config keys
  - CLI commands
  - file paths
  - API routes
  - code identifiers
- Translate the explanation around them, not the identifiers themselves.

### Preferred wording

Use repository terminology that matches the current Korean docs and standalone examples:

- `tinyauth`:
  - default body-text reference: ``tinyauth``
  - keep existing casing when copying titles, branding strings, or UI text such as `Tinyauth`
- `OIDC Provider`:
  - prefer `인증 공급자(OIDC Provider)` on the first descriptive mention when helpful
  - after that, use `OIDC`, `OIDC 제공자`, or `인증 서버` only if the context is already clear
- `self-hosted` -> `셀프 호스팅`
- `standalone` -> keep `standalone`
  - good: `standalone 전용 설정`, `standalone 서버`
  - avoid forcing awkward terms like `독립 실행형`
- `passkey` -> `패스키`
  - first mention can be `패스키(WebAuthn)` when clarification helps
- `reverse proxy` -> `리버스 프록시`
- `public origin` -> usually explain as `공개 URL`
- `issuer metadata` -> keep `issuer metadata` if protocol precision matters

### Technical terms to keep in English

Keep standard protocol terms in English unless the surrounding docs already use a stable Korean phrasing:

- OAuth 2.0
- OpenID Connect (OIDC)
- Authorization Code Flow
- PKCE
- scope
- issuer
- redirect URI
- access token
- refresh token

## Formatting Rules

- Keep Markdown structure clean and scannable.
- Use headings to separate setup, reference, examples, and next steps.
- Use bullet lists for:
  - prerequisites
  - options
  - next steps
  - concise comparisons
- Use tables for schema or reference pages where many fields are being compared.
- Use note/callout blocks for caveats such as standalone-only behavior.
- Keep code blocks and config snippets exactly valid.
- Use backticks in prose for product names, config keys, env vars, commands, and paths.

## Standalone Documentation Guidance

When the documentation is about standalone behavior, extract facts from the standalone package first and match the Korean docs style second.

### What to verify

For standalone-related docs, verify against the package source before writing:

1. `packages/standalone/config.example.yaml`
2. `packages/standalone/src/lib/config/defaults.ts`
3. relevant files in `packages/standalone/src/lib/config/**`

### What to emphasize

Standalone docs should usually explain:

- how to run with `config.yaml`
- how Docker or Docker Compose mounts the config and data path
- how environment-variable interpolation works
- which settings are standalone-only
- what operational effect a setting has at runtime
  - for example `server.public_origin`, `server.trust_proxy`, `frontend.mode`, or database settings

### Standalone-specific accuracy rules

- Clearly distinguish shared config from standalone-only config.
  - especially `frontend` and `frontend.html_variables`
- Do not invent defaults not confirmed by the package.
- Do not assume environment variable names from older prose snippets.
- If env var names or defaults are documented, confirm them from standalone source first.
- Keep deployment examples aligned with current package behavior and file paths.

## Repo-Specific Writing Guidance

- For overview pages, keep the tone welcoming and practical.
- For configuration pages, explain both:
  - what a field means
  - when a reader would care about it
- For deployment pages, prefer examples readers can copy with minimal edits.
- For schema/reference pages, keep descriptions short and high-signal.
- For UI-facing strings, keep wording brief and natural, and align with existing locale phrasing when available.

## Accuracy Checklist

Before finalizing Korean documentation, check:

1. Technical meaning matches the actual source.
2. Commands and config examples remain executable.
3. Config keys, defaults, and env var names match `packages/standalone/**` when relevant.
4. Standalone-only settings are not presented as backend-wide settings.
5. Terminology matches nearby Korean docs.
6. The prose sounds natural in Korean and not machine-translated.

## Workflow

When using this skill:

1. Read the target file and nearby Korean docs in the same section.
2. Identify the audience:
   - integrator
   - operator
   - end user
3. If the page is standalone-related, read `packages/standalone/config.example.yaml` and relevant config source files.
4. Draft in the existing Korean docs voice, which is usually **해요체**.
5. Preserve all technical identifiers exactly.
6. Do a final pass for:
   - awkward phrasing
   - repeated particles
   - inconsistent `tinyauth` / `Tinyauth` casing
   - inconsistent borrowed terms
   - mismatched env var names or defaults

## Output Expectations

Return:

- the drafted Korean content
- any terminology decisions that may need repo-wide consistency
- any unclear or outdated source wording that should also be fixed in the original docs

## Avoid

- Literal sentence-by-sentence translation
- Overly stiff `합니다/하십시오` documentation tone as the default
- Awkward Korean translations of `standalone`
- Excessive parentheses for every English term
- Changing code or config semantics while improving readability
- Reusing outdated config defaults or env var names without checking the standalone package
- Mixing backend-only and standalone-only behavior in the same explanation
