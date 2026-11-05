// 美圖配方／美容配方：把目前的修圖存起來，下一張照片按一下就套用同樣的效果

import { defineTool, type EditorMode } from '../../core/tool.ts'
import { IconRecipe } from '../../ui/icons.tsx'
import { RecipePanel, type RecipeParams } from './RecipePanel.tsx'

function makeRecipeTool(id: string, label: string, mode: EditorMode) {
  return defineTool<RecipeParams>({
    id,
    label,
    icon: <IconRecipe />,
    placement: { [mode]: 10 },
    defaultParams: { applied: null },
    // 自己沒有效果；效果都在被設定的那些工具裡
    isIdentity: () => true,
    Panel: (props) => <RecipePanel params={props.params} toolId={id} mode={mode} />,
  })
}

export const recipeTool = makeRecipeTool('recipe', '美圖配方', 'beautify')
export const beautyRecipeTool = makeRecipeTool('beautyRecipe', '美容配方', 'portrait')
