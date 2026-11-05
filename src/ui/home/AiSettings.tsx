import { useState } from 'react'
import { aiPing, getAiSettings, setAiSettings } from '../../core/ai.ts'
import '../ai/ai.css'

// 「我」裡面的 AI 設定：Worker 網址、通行碼（只存在這台手機），可以測試連線
export function AiSettings() {
  const [s, setS] = useState(getAiSettings)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch }
    setS(next)
    setAiSettings(next)
    setTest(null)
  }

  const run = async () => {
    setBusy(true)
    try {
      const model = await aiPing()
      setTest({ ok: true, text: `連線成功（模型：${model || '未設定'}）` })
    } catch (e) {
      setTest({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="me-card">
      <h2 className="sheet-title">AI 服務</h2>
      <label className="ai-field">
        Worker 網址
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="https://prettyshow-ai.xxx.workers.dev"
          value={s.url}
          onChange={(e) => update({ url: e.target.value })}
        />
      </label>
      <label className="ai-field">
        通行碼
        <input type="password" autoCapitalize="off" placeholder="部署 Worker 時設定的通行碼" value={s.code} onChange={(e) => update({ code: e.target.value })} />
      </label>
      <div className="ai-test">
        <button disabled={busy || !s.url || !s.code} onClick={() => void run()}>
          {busy ? '測試中…' : '測試連線'}
        </button>
        {test && <span style={{ color: test.ok ? '#7fd88f' : '#ff8a8a' }}>{test.text}</span>}
      </div>
      <p className="me-line" style={{ marginTop: 10, fontSize: 12 }}>
        要給朋友用：把網址和通行碼告訴他，在他的手機上填一次就好。
      </p>
    </section>
  )
}
