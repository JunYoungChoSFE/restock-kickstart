import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// 순수 로직 단위테스트용 설정. reactRouter() 플러그인 없이 돌려 앱 셸 없이도 테스트 가능.
// (앱 셸·라우트가 들어오면 통합 테스트는 vite.config.ts 경로를 따로 쓴다.)
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["app/**/*.test.ts"],
  },
});
