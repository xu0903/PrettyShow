# PrettyShow AI 中繼站（Cloudflare Worker）

App 的「AI 修圖」會把照片送到這個 Worker，Worker 帶著 API 金鑰去呼叫 Google Gemini 的圖片模型，再把結果傳回 App。
**API 金鑰只存在 Cloudflare**，不會出現在網站或 GitHub 上；網站是公開的，所以另外用「通行碼」擋住陌生人。

## 一、申請 Google AI Studio 的 API 金鑰（要綁信用卡）

1. 打開 <https://aistudio.google.com/apikey>，用 Google 帳號登入。
2. 按「建立 API 金鑰」，複製起來（等一下要用，**不要貼到任何網站或聊天裡**）。
3. 圖片模型沒有免費額度，要開啟付費：在 AI Studio 左下角「Billing / 帳單」設定付款方式。
4. 建議設定預算提醒：到 <https://console.cloud.google.com/billing> →「預算與快訊」設一個金額（例如每月 NT$300），超過會寄信通知你。

## 二、註冊 Cloudflare（免費）

到 <https://dash.cloudflare.com/sign-up> 註冊。免費方案每天 10 萬次請求，自己和朋友用綽綽有餘。

## 三、部署（在這台電腦上，只要做一次）

在專案的 `worker` 資料夾打開終端機，依序執行：

```bash
npm install
npx wrangler login                    # 會打開瀏覽器，登入 Cloudflare 並按「允許」
npx wrangler secret put GEMINI_API_KEY  # 貼上剛剛複製的 API 金鑰，按 Enter
npx wrangler secret put ACCESS_CODE     # 自己想一組通行碼（例如 8 個字以上的英數字），按 Enter
npx wrangler deploy
```

第一次部署會請你取一個 `workers.dev` 的子網域。完成後會顯示網址，例如：

```
https://prettyshow-ai.你的名字.workers.dev
```

## 四、在 App 裡設定

打開 PrettyShow →「我」→「AI 服務」：

- **Worker 網址**：上面那個網址
- **通行碼**：剛剛設定的 ACCESS_CODE

按「測試連線」，出現「連線成功」就可以到「AI 修圖」使用了。
要給朋友用：把網址和通行碼告訴他，在他的手機上也填一次。

## 換模型

編輯 `wrangler.toml` 的 `MODEL`，再執行一次 `npx wrangler deploy`：

| 模型 | 約略價格（每張） | 說明 |
|---|---|---|
| `gemini-3.1-flash-image` | US$0.067 | Nano Banana 2，預設 |
| `gemini-3.1-flash-lite-image` | US$0.034 | 便宜一半，細節略差 |
| `gemini-3-pro-image` | US$0.134 | 品質最好 |
| `gemini-nano-banana-2.1` | US$0.034 | Google 目前推薦的新版 |

價格以 Google 的公告為準：<https://aistudio.google.com/docs/pricing>

## 換通行碼

`npx wrangler secret put ACCESS_CODE` 輸入新的通行碼即可（舊的立刻失效，記得告訴朋友新的）。

## 檔案

- `src/index.js`：接收請求、檢查通行碼、呼叫 Gemini、回傳圖片
- `src/prompts.js`：每個 AI 功能的提示詞（網站只送「功能＋選項」，不能讓 AI 做別的事）
- `wrangler.toml`：設定（模型、允許的網站）
