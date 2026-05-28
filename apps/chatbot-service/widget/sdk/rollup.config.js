import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import postcss from 'rollup-plugin-postcss';
import { config } from 'dotenv';

const production = process.env.NODE_ENV === 'production';

// Load environment variables based on NODE_ENV
const envFiles = ['.env'];
if (production) {
  envFiles.unshift('.env.production');
} else if (process.env.NODE_ENV === 'development') {
  envFiles.unshift('.env.development');
}

// Load env files in order (later files override earlier ones)
envFiles.forEach(file => {
  config({ path: file });
});

export default {
  input: 'src/index.ts',
  output: [
    // UMD build for browsers (like the example you provided)
    {
      file: 'dist/sdk.js',
      format: 'umd',
      name: 'FoxAI',
      sourcemap: true,
      exports: 'named',
      globals: {}
    },
    // ES Module build for modern bundlers
    {
      file: 'dist/sdk.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named'
    }
  ],
  plugins: [
    // Handle CSS - inject into <style> tag at runtime
    postcss({
      inject: true,
      minimize: production,
      sourceMap: !production
    }),
    
    // Replace environment variables
    replace({
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL),
      'import.meta.env.VITE_API_VERSION': JSON.stringify(process.env.VITE_API_VERSION),
      'import.meta.env.VITE_DEFAULT_PROVIDER_LLM': JSON.stringify(process.env.VITE_DEFAULT_PROVIDER_LLM),
      'import.meta.env.VITE_DEFAULT_PROVIDER_STORAGE': JSON.stringify(process.env.VITE_DEFAULT_PROVIDER_STORAGE),
      'import.meta.env.VITE_DEFAULT_PROVIDER_EMBEDDING': JSON.stringify(process.env.VITE_DEFAULT_PROVIDER_EMBEDDING),
      'import.meta.env.VITE_DEFAULT_COLLECTION_NAME': JSON.stringify(process.env.VITE_DEFAULT_COLLECTION_NAME),
      'import.meta.env.VITE_DEFAULT_BOT_NAME': JSON.stringify(process.env.VITE_DEFAULT_BOT_NAME),
      'import.meta.env.VITE_DEFAULT_BOT_AVATAR': JSON.stringify(process.env.VITE_DEFAULT_BOT_AVATAR),
      'import.meta.env.VITE_DEFAULT_GREETING': JSON.stringify(process.env.VITE_DEFAULT_GREETING),
      'import.meta.env.VITE_DEFAULT_PRIMARY_COLOR': JSON.stringify(process.env.VITE_DEFAULT_PRIMARY_COLOR),
      'import.meta.env.VITE_DEBUG_MODE': JSON.stringify(process.env.VITE_DEBUG_MODE),
      'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(process.env.VITE_LOG_LEVEL),
      preventAssignment: true
    }),
    
    // Resolve node_modules
    resolve({
      browser: true
    }),
    
    // Convert CommonJS modules to ES6
    commonjs(),
    
    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist/types'
    }),
    
    // Minify in production
    production && terser({
      format: {
        comments: false
      },
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true
      }
    })
  ].filter(Boolean)
};
