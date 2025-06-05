import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      define: {
        // 開発環境用
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            'shooting-plan': path.resolve(__dirname, 'shooting-plan.html')
          },
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom']
            }
          }
        }
      },
      plugins: [
        // 本番ビルド時にHTMLファイルの環境変数プレースホルダーを置換
        {
          name: 'replace-env-vars',
          generateBundle(options, bundle) {
            // HTMLファイルを見つけて環境変数を置換
            for (const fileName in bundle) {
              if (fileName.endsWith('.html')) {
                const file = bundle[fileName] as any;
                if (file.source) {
                  file.source = file.source
                    .replace('%VITE_GOOGLE_CLIENT_ID%', process.env.VITE_GOOGLE_CLIENT_ID || '')
                    .replace('%VITE_API_KEY%', process.env.VITE_API_KEY || '');
                }
              }
            }
          }
        }
      ]
    };
});
