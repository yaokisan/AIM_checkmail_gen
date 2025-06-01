import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync } from 'fs';

// 本番ビルド後にプレースホルダーを置換するプラグイン
const replaceEnvPlaceholders = () => {
  return {
    name: 'replace-env-placeholders',
    closeBundle() {
      try {
        const prodConfigPath = path.resolve(__dirname, 'dist/env-config.production.js');
        let content = readFileSync(prodConfigPath, 'utf8');
        
        // プレースホルダーを環境変数で置換
        content = content.replace('__VITE_GOOGLE_CLIENT_ID__', process.env.VITE_GOOGLE_CLIENT_ID || '');
        content = content.replace('__VITE_API_KEY__', process.env.VITE_API_KEY || '');
        
        writeFileSync(prodConfigPath, content);
        console.log('✅ Environment variables injected into production config');
      } catch (error: any) {
        console.log('⚠️ Could not inject environment variables:', error.message);
      }
    }
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      define: {
        // 開発環境用
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        
        // 本番環境用（Vercelの環境変数から）
        'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
        'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 本番ビルド時の設定
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom']
            }
          }
        }
      },
      plugins: mode === 'production' ? [replaceEnvPlaceholders()] : []
    };
});
