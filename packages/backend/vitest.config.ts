import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    chaiConfig: {
      truncateThreshold: 0, // 0으로 설정하면 줄임을 비활성화하여 전체 객체를 보여줌
    },
    exclude: [
      './dist/*',
      './node_modules/*',
    ],
  },
});
