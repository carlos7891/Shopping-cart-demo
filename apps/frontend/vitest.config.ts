import { defineConfig, Plugin } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Plugin ligero para que Vitest resuelva `templateUrl` y `styleUrl` / `styleUrls`
 * de componentes Angular con archivos .html y .css separados durante las pruebas unitarias.
 */
function angularTemplateUrlInlinePlugin(): Plugin {
  return {
    name: 'angular-template-url-inline',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.component.ts')) {
        return null;
      }
      const dir = path.dirname(id);
      let transformed = code;

      transformed = transformed.replace(
        /templateUrl\s*:\s*['"]([^'"]+)['"]/g,
        (_match, relPath: string) => {
          const fullPath = path.resolve(dir, relPath);
          const htmlContent = fs.readFileSync(fullPath, 'utf-8');
          return `template: ${JSON.stringify(htmlContent)}`;
        }
      );

      transformed = transformed.replace(
        /styleUrl\s*:\s*['"]([^'"]+)['"]/g,
        (_match, relPath: string) => {
          const fullPath = path.resolve(dir, relPath);
          const cssContent = fs.existsSync(fullPath)
            ? fs.readFileSync(fullPath, 'utf-8')
            : '';
          return `styles: [${JSON.stringify(cssContent)}]`;
        }
      );

      return { code: transformed, map: null };
    }
  };
}

export default defineConfig({
  plugins: [angularTemplateUrlInlinePlugin()],
  resolve: {
    alias: {
      '@shopping-cart/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/app/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/app/app.config.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
