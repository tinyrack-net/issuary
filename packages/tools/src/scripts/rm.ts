import { removePaths } from '../lib/remove-paths.ts';

await removePaths(process.argv.slice(2));
