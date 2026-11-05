// 所有編輯工具在這裡註冊。新增工具只要寫好模組、在這裡加一行，核心程式不用改。

import { registerTool } from '../core/registry.ts'
import { acneTool } from './acne/index.tsx'
import { adjustTool } from './adjust/index.tsx'
import { autoTool } from './auto/index.tsx'
import { beautyTool } from './beauty/index.tsx'
import { bokehTool } from './bokeh/index.tsx'
import { cropTool } from './crop/index.tsx'
import { doodleTool } from './doodle/index.tsx'
import { eraserTool } from './eraser/index.tsx'
import { eyesTool, teethTool } from './features/index.tsx'
import { filterTool } from './filter/index.tsx'
import { frameTool } from './frame/index.tsx'
import { hairTool } from './hair/index.tsx'
import { idPhotoTool } from './idphoto/index.tsx'
import { liquifyTool } from './liquify/index.tsx'
import { makeupTool } from './makeup/index.tsx'
import { mosaicTool } from './mosaic/index.tsx'
import { oneTapTool } from './onetap/index.tsx'
import { beautyRecipeTool, recipeTool } from './recipe/index.tsx'
import { reshapeTool } from './reshape/index.tsx'
import { stickerTool } from './sticker/index.tsx'
import { tallerTool } from './taller/index.tsx'
import { textTool } from './text/index.tsx'

registerTool(adjustTool)
registerTool(autoTool)
registerTool(beautyTool)
registerTool(bokehTool)
registerTool(filterTool)
registerTool(cropTool)
registerTool(frameTool)
registerTool(stickerTool)
registerTool(textTool)
registerTool(recipeTool)
registerTool(beautyRecipeTool)
registerTool(mosaicTool)
registerTool(doodleTool)
registerTool(acneTool)
registerTool(eraserTool)
registerTool(reshapeTool)
registerTool(liquifyTool)
registerTool(tallerTool)
registerTool(makeupTool)
registerTool(eyesTool)
registerTool(teethTool)
registerTool(hairTool)
registerTool(oneTapTool)
registerTool(idPhotoTool)
