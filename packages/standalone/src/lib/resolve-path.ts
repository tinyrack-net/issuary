import path from 'node:path';

export function resolveAbsolutePath(
  filePath: string,
  basePath?: string,
): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(basePath ?? process.cwd(), filePath);
}
