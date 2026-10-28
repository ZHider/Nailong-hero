import { defineConfig } from 'vite';

// 原站点部署在子目录（https://h5.metaapp.cn/online/h5/<id>/1.0.2/6/），
// 因此使用相对 base，产物可以直接放到任意子目录下运行。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'build', // 与 public/assets 区分：素材仍走 ./assets/**
    target: 'es2020',
    cssCodeSplit: true,
    emptyOutDir: true,
  },
  server: { port: 5173 },
});
