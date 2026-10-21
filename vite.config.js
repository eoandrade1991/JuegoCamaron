import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Permite que funcione en GitHub Pages, subdirectorios o cualquier servidor estático
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
