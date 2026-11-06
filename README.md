# PrettyShow

自用的 iPhone 修圖 PWA（Vite + React + TypeScript + WebGL2）。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器（已開放區網，iPhone 可連 `http://<電腦IP>:5173`） |
| `npm run build` | 正式建置到 `dist/` |
| `npm run preview` | 預覽正式建置結果（同樣開放區網） |
| `npm test` | 單元測試 |
| `npm run luts` | 重新產生內建濾鏡的 LUT（`scripts/gen-luts.mjs`，輸出到 `public/luts/`） |
| `npm run icons` | 從 `design/icon-sheet.png` 切出 App 圖示（選哪幾格、預設哪一個在 `scripts/split-icons.mjs`） |

## 部署

push 到 `main` 後，GitHub Actions 會自動建置並部署到 GitHub Pages：
`https://<帳號>.github.io/<repo>/`

## 發佈新版

1. 把 `package.json` 的 `version` 加一
2. 在 `src/version.ts` 的 `CHANGELOG` 寫這一版的更新內容
3. push 到 `main`；使用者下次打開 App 會自動更新，並跳出「已更新到 vX」的通知

## 加入新的濾鏡

把 `.cube` 或 PNG 長條 LUT 放進 `public/luts/`，再到 `src/tools/filter/presets.ts` 加一行（`file` 寫檔名）即可。

## 美顏（MediaPipe）

- 臉部辨識用 `@mediapipe/tasks-vision` 的 Face Landmarker，CPU 模式執行。
- wasm 由 Vite 從 `node_modules` 打包進 `dist/assets`；模型放在 `public/models/face_landmarker.task`（Apache-2.0，來源：Google MediaPipe）。
- 兩者都不預先快取，第一次打開美顏時才下載，之後由 service worker 的 `face-models` 快取提供。
- 升級 MediaPipe 時鎖定確切版本（`--save-exact`）。

## 新增工具

1. 在 `src/tools/<名稱>/` 寫好工具模組（`defineTool`），用 `placement` 指定放在哪個編輯器（`beautify` 圖片美化、`portrait` 人像美容）的第幾個位置。
2. 在 `src/tools/index.ts` 註冊。
3. 如果 `src/tools/upcoming.tsx` 裡有它的「即將推出」佔位，刪掉那一項。

## 筆刷工具

- 共用模組在 `src/tools/brush/`：`createBrushOverlay` 處理手指塗抹、兩指縮放、座標換算；`BrushControls` 是畫筆／橡皮擦和大小。
- 筆跡以「原圖座標」存在編輯參數裡（`Stroke`），渲染時才依解析度畫成遮罩（`strokeTexture`），匯出原圖一樣清楚。
- 會改變幾何的工具（裁切）提供 `mapToSource`，筆刷就能把畫面上的位置換算回原圖。

## AI 修圖（Cloudflare Worker）

`worker/` 是 AI 修圖用的中繼站，API 金鑰只放在 Cloudflare。部署步驟見 [worker/README.md](worker/README.md)。

## 第三方模型與授權

| 用途 | 模型 | 授權 |
|---|---|---|
| 臉部特徵點、頭髮分割、人像分割 | Google MediaPipe（face_landmarker、hair_segmenter、selfie_segmenter） | Apache-2.0 |
| 消除筆、消除路人（手機上） | MI-GAN（Picsart AI Research），`public/models/migan_pipeline_v2.onnx` | MIT，見 `public/models/MI-GAN-LICENSE.txt` |
| 執行 ONNX 模型 | onnxruntime-web | MIT |
