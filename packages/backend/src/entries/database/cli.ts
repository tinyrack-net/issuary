import { postgres } from './postgres.js';
import { sqlite } from './sqlite.js';

const mode = process.env['DATABASE_MODE'] as 'sqlite' | 'postgres';

const optionsLoaders = (() => {
  if (mode === 'postgres') {
    return postgres({
      host: '0.0.0.0',
      name: 'tinyauth',
      password: 'tinyauth',
      port: 5432,
      user: 'tinyauth',
    }).getMikroOrmOptions();
  } else {
    return sqlite({
      path: './test.db',
      test: false,
    }).getMikroOrmOptions();
  }
})();

export default await optionsLoaders;
