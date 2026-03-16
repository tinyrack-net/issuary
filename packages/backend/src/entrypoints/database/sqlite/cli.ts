import { sqlite } from './sqlite.js';

export default await sqlite({
  path: '/path/some',
  test: true,
}).getMikroOrmOptions();
