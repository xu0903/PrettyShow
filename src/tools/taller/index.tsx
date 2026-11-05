// 增高：拖兩條線選出要拉長的範圍（通常是腰到腳），滑桿調整拉多長

import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconHeight } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { DEFAULT_TALLER, factor, stretchedSize, toBefore, type TallerParams } from './stretch.ts'
import { TallerOverlay } from './TallerOverlay.tsx'
import '../beauty/beauty.css'

const stretchFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform float u_top;    // 拉長那一段的開頭（拉長前，0..1，由上往下）
uniform float u_bottom;
uniform float u_f;      // 倍數

void main() {
  float total = 1.0 + (u_bottom - u_top) * (u_f - 1.0);
  float yo = (1.0 - v_uv.y) * total; // 換成由上往下
  float t1 = u_top + (u_bottom - u_top) * u_f;
  float yi = yo < u_top ? yo : (yo < t1 ? u_top + (yo - u_top) / u_f : yo - (u_bottom - u_top) * (u_f - 1.0));
  outColor = texture(u_image, vec2(v_uv.x, 1.0 - yi));
}`

export const tallerTool = defineTool<TallerParams>({
  id: 'taller',
  label: '增高',
  icon: <IconHeight />,
  placement: { portrait: 100 },
  defaultParams: DEFAULT_TALLER,
  isIdentity: (p) => !p.amount,

  steps: (p) => [
    {
      order: ORDER.stretch,
      pass: {
        id: 'taller',
        fragment: stretchFragment,
        uniforms: { u_top: p.top, u_bottom: p.bottom, u_f: factor(p) },
        outputSize: (input) => stretchedSize(input, p),
      },
    },
  ],
  mapToSource: (p, pt) => ({ x: pt.x, y: toBefore(pt.y, p) }),
  mapSize: (p, input) => stretchedSize(input, p),
  geometryOrder: ORDER.stretch,
  isolateView: true,
  Overlay: TallerOverlay,

  Panel: function TallerPanel({ params, onChange, onCommit }) {
    return (
      <div className="beauty-panel">
        <Slider
          label="增高"
          value={params.amount}
          min={0}
          max={100}
          onChange={(v) => onChange({ ...params, amount: v })}
          onCommit={(v) => onCommit({ ...params, amount: v })}
        />
        <p className="brush-hint">先拖照片上的兩條線框出要拉長的部分（例如腰到腳），再拉滑桿</p>
      </div>
    )
  },
})
