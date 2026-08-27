#!/usr/bin/env bash

set -euo pipefail

docs_only=true
full=false
frontend=false
server=false
standalone=false
tools=false
homepage=false
examples=false
has_files=false

while IFS= read -r file; do
  if [[ -z "${file}" ]]; then
    continue
  fi

  has_files=true
  case "${file}" in
    *.md|docs/*)
      ;;
    packages/frontend/*)
      docs_only=false
      frontend=true
      ;;
    packages/server/*)
      docs_only=false
      server=true
      ;;
    packages/standalone/*)
      docs_only=false
      standalone=true
      ;;
    packages/tools/*)
      docs_only=false
      tools=true
      ;;
    packages/homepage/*)
      docs_only=false
      homepage=true
      ;;
    examples/*)
      docs_only=false
      examples=true
      ;;
    *)
      docs_only=false
      full=true
      ;;
  esac
done

if [[ "${has_files}" == false ]]; then
  docs_only=false
  full=true
fi

if [[ "${full}" == true ]]; then
  frontend=true
  server=true
  standalone=true
  tools=true
  homepage=true
  examples=true
fi

printf 'docs_only=%s\n' "${docs_only}"
printf 'full=%s\n' "${full}"
printf 'frontend=%s\n' "${frontend}"
printf 'server=%s\n' "${server}"
printf 'standalone=%s\n' "${standalone}"
printf 'tools=%s\n' "${tools}"
printf 'homepage=%s\n' "${homepage}"
printf 'examples=%s\n' "${examples}"
