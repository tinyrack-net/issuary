import { sqlite } from './sqlite.ts';

export default await sqlite({
  path: '/path/some',
  test: true,
}).getMikroOrmOptions();
