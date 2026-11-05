/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages 會把網站放在 https://<帳號>.github.io/<repo>/ 底下，
// 所以部署時由 GitHub Actions 傳入 BASE_PATH=/<repo>/；本機開發則用根路徑。
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  // 版本號顯示在設定頁，版本改變時打開 App 會跳出更新通知（見 src/version.ts）
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    // 開放區網連線，讓同一個 Wi-Fi 的 iPhone 可以連進來
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 在 main.tsx 用 virtual:pwa-register 自己註冊，新版裝好時才能自動重新載入
      injectRegister: false,
      // manifest 以外的 iOS 專用 meta 寫在 index.html
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'PrettyShow 修圖',
        short_name: 'PrettyShow',
        description: '自用的 iPhone 修圖工具',
        lang: 'zh-Hant-TW',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0e11',
        theme_color: '#0e0e11',
        // 用相對路徑，部署在子路徑下也能正確運作
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 預先快取 App 本體和內建 LUT，讓 App 可以離線開啟
        globPatterns: ['**/*.{js,css,html,png,svg,cube,webmanifest}'],
        // 美顏用的臉部辨識（wasm 約 13MB、模型 3.6MB）不預先下載，第一次用到時才抓，之後從快取讀
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\.(wasm|task)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models',
              // 檔名有版本雜湊，舊版本的檔案留著也沒用
              expiration: { maxEntries: 6 },
            },
          },
          {
            // 文字工具的網路字型：第一次用到才下載，之後離線也能用
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'web-fonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
