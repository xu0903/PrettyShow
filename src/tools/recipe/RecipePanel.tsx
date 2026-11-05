// 配方面板：內建配方、自己存的配方、存目前的修圖

import { useState } from 'react'
import { useEditor } from '../../core/store.ts'
import type { EditorMode } from '../../core/tool.ts'
import { toast } from '../../ui/toast.ts'
import { BUILTIN, loadRecipes, patchFor, pick, saveRecipes, type Recipe } from './recipes.ts'
import '../beauty/beauty.css'
import '../layers/layers.css'

export interface RecipeParams {
  /** 最近套用的配方（只用來標示選取） */
  applied: string | null
}

export function RecipePanel({ params, toolId, mode }: { params: RecipeParams; toolId: string; mode: EditorMode }) {
  const commitPatch = useEditor((s) => s.commitPatch)
  const [mine, setMine] = useState(() => loadRecipes().filter((r) => r.mode === mode))
  const [managing, setManaging] = useState(false)
  const list = [...BUILTIN.filter((r) => r.mode === mode), ...mine]

  const apply = (r: Recipe) => {
    const state = useEditor.getState().history.present
    commitPatch({ ...patchFor(r, state), [toolId]: { applied: r.id } })
  }

  const save = () => {
    const state = useEditor.getState().history.present
    const picked = pick(state, mode)
    if (Object.keys(picked).length === 0) {
      toast('先修一下照片，再存成配方')
      return
    }
    const name = prompt('幫這個配方取個名字', `我的配方 ${mine.length + 1}`)?.trim()
    if (!name) return
    const r: Recipe = { id: `r${Date.now().toString(36)}`, name, mode, state: picked }
    const all = [...loadRecipes(), r]
    saveRecipes(all)
    setMine(all.filter((x) => x.mode === mode))
    toast(`已存成「${name}」`)
  }

  const remove = (r: Recipe) => {
    const all = loadRecipes().filter((x) => x.id !== r.id)
    saveRecipes(all)
    setMine(all.filter((x) => x.mode === mode))
  }

  return (
    <div className="layers-panel">
      <div className="chip-row">
        {list.map((r) => (
          <button
            key={r.id}
            className="chip"
            aria-pressed={params.applied === r.id}
            onClick={() => (managing && !r.builtin ? remove(r) : apply(r))}
          >
            {managing && !r.builtin ? `✕ ${r.name}` : r.name}
          </button>
        ))}
      </div>
      <div className="layers-empty">
        <button className="layers-add" onClick={save}>
          ＋ 把目前的修圖存成配方
        </button>
        {mine.length > 0 && (
          <button className="link-btn" onClick={() => setManaging(!managing)}>
            {managing ? '完成' : '刪除自己的配方'}
          </button>
        )}
      </div>
    </div>
  )
}
