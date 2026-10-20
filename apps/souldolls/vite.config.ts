import path from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";

const repoRoot = searchForWorkspaceRoot(process.cwd());

const workspaceAliases = {
  "@ggez/gameplay-runtime": path.resolve(repoRoot, "packages/gameplay-runtime/src/index.ts"),
  "@ggez/runtime-format": path.resolve(repoRoot, "packages/runtime-format/src/index.ts"),
  "@ggez/shared": path.resolve(repoRoot, "packages/shared/src/index.ts"),
  "@ggez/three-runtime/loader": path.resolve(repoRoot, "packages/three-runtime/src/loader/index.ts")
};

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three"]
        }
      }
    }
  },
  resolve: {
    alias: workspaceAliases,
    dedupe: ["three"]
  },
  server: {
    fs: {
      allow: [repoRoot]
    },
    host: "127.0.0.1"
  }
});
