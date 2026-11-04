// 編輯工具的介面。每個工具都是一個獨立模組，在 src/tools/index.ts 註冊，
// 核心（編輯堆疊、渲染管線、工具列）不需要知道有哪些工具。
//
// 之後要加的工具類型：
// - 美顏（MediaPipe）：用 prepare 先偵測臉部特徵點，再用 steps 做網格變形／磨皮 shader
// - AI 工具（Cloudflare Worker）：用 raster 步驟產生新的點陣圖當作檢查點（之後再加入介面）

import type { ComponentType, ReactNode } from 'react'
import type { RenderPass } from '../gl/pass.ts'

/** 產生 shader 步驟時的環境資訊 */
export interface PassContext {
  /**
   * 目前渲染解析度相對於預覽圖的倍數：預覽時是 1，匯出原圖時大約是 2–3。
   * 以像素為單位的效果（例如銳化半徑）要乘上這個值，預覽和匯出的效果才會一致。
   */
  pixelScale: number
}

/** 管線中的一個步驟；order 越小越先執行 */
export interface GpuStep {
  order: number
  pass: RenderPass
}

/** 建議的順序區間（同一個工具的不同步驟可以放在不同區間） */
export const ORDER = {
  geometry: 100, // 裁切、旋轉、翻轉
  color: 200, // 亮度、對比、色溫…
  filter: 300, // LUT 濾鏡
  detail: 400, // 銳化、暈影
} as const

export interface ToolPanelProps<P> {
  params: P
  /** 拖動滑桿中：只更新預覽，不寫入歷史 */
  onChange: (params: P) => void
  /** 放開滑桿：寫入一筆歷史紀錄 */
  onCommit: (params: P) => void
}

/** 疊在照片上的操作層（例如裁切框）收到的參數 */
export interface ToolOverlayProps<P> extends ToolPanelProps<P> {
  /** 照片在畫面上顯示的尺寸（CSS px） */
  stageSize: { width: number; height: number }
}

export interface EditTool<P> {
  id: string
  label: string
  icon: ReactNode
  /** 在工具列上的排列順序 */
  tabOrder: number
  defaultParams: P
  /** 參數是預設值時，整個工具會被略過 */
  isIdentity: (params: P) => boolean
  /**
   * 產生 shader 步驟。必須是同步的；需要的資源還沒準備好時可以先回傳空陣列，
   * 等 prepare 完成後畫面會再重畫一次。
   */
  steps?: (params: P, ctx: PassContext) => GpuStep[]
  /** 非同步準備資源（下載 LUT、偵測臉部…），完成後 steps 才能產生完整的步驟 */
  prepare?: (params: P) => Promise<void>
  /**
   * 這個工具的面板打開時，畫面改用這組參數顯示。
   * 例如裁切時要看到整張照片，才能拖動裁切框。
   */
  viewParams?: (params: P) => P
  /** 下方工具列的操作面板 */
  Panel: ComponentType<ToolPanelProps<P>>
  /** 面板打開時疊在照片上的操作層；有操作層時照片區的縮放手勢會暫停 */
  Overlay?: ComponentType<ToolOverlayProps<P>>
}

/** 建立工具時用這個函式包起來，TypeScript 才能檢查 params 的型別 */
export function defineTool<P>(tool: EditTool<P>): EditTool<P> {
  return tool
}
