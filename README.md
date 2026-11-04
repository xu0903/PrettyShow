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
