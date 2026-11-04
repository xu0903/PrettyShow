# PrettyShow

自用的 iPhone 修圖 PWA（Vite + React + TypeScript + WebGL2）。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器（已開放區網，iPhone 可連 `http://<電腦IP>:5173`） |
| `npm run build` | 正式建置到 `dist/` |
| `npm run preview` | 預覽正式建置結果（同樣開放區網） |
| `npm test` | 單元測試 |
| `npm run gen:icons` | 重新產生 App 圖示（款式在 `scripts/gen-icons.mjs` 的 `DEFAULT_DESIGN`） |
| `node scripts/gen-icons.mjs --preview out.png` | 產生全部圖示款式的對照圖 |

## 部署

push 到 `main` 後，GitHub Actions 會自動建置並部署到 GitHub Pages：
`https://<帳號>.github.io/<repo>/`
