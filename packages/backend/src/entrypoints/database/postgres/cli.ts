import { postgres } from './postgres.ts';

export default await postgres({
  host: 'localhost',
  name: 'tinyauth',
  password: 'tinyauth',
  port: 5432,
  user: 'tinyauth',
}).getMikroOrmOptions();
