// 介面用的線條圖示（inline SVG，跟著 currentColor 變色）
import type { ReactNode, SVGProps } from 'react'

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconUndo = () => (
  <Svg>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
)

export const IconRedo = () => (
  <Svg>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
)

export const IconShare = () => (
  <Svg>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Svg>
)

export const IconSettings = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
)

export const IconPhoto = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Svg>
)

export const IconSliders = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
)

export const IconFilter = () => (
  <Svg>
    <circle cx="9" cy="9" r="5" />
    <circle cx="15" cy="9" r="5" />
    <circle cx="12" cy="15" r="5" />
  </Svg>
)

export const IconCrop = () => (
  <Svg>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M2 6h14a2 2 0 0 1 2 2v14" />
  </Svg>
)

export const IconRotateLeft = () => (
  <Svg>
    <path d="M3 4v5h5" />
    <path d="M3.5 9A8.5 8.5 0 1 1 6 16.5" />
  </Svg>
)

export const IconFlipH = () => (
  <Svg>
    <path d="M12 3v18" strokeDasharray="2 2.5" />
    <path d="M9 7 4 17h5z" />
    <path d="m15 7 5 10h-5z" />
  </Svg>
)

export const IconFlipV = () => (
  <Svg>
    <path d="M3 12h18" strokeDasharray="2 2.5" />
    <path d="M7 9 17 4v5z" />
    <path d="m7 15 10 5v-5z" />
  </Svg>
)

export const IconFace = () => (
  <Svg>
    <circle cx="11" cy="13" r="8" />
    <path d="M8 15.5c1.6 1.4 4.4 1.4 6 0" />
    <path d="M8.5 11h.01M13.5 11h.01" strokeWidth="2.6" />
    <path d="M19 2.5v4M17 4.5h4" />
  </Svg>
)

// ---- 首頁、圖庫、編輯器外框 ----

export const IconHome = () => (
  <Svg>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-5h4v5" />
  </Svg>
)

export const IconGallery = () => (
  <Svg>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Svg>
)

export const IconAI = () => (
  <Svg>
    <path d="M12 3c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" />
    <path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />
  </Svg>
)

export const IconUser = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" />
  </Svg>
)

export const IconBack = () => (
  <Svg>
    <path d="M15 5 8 12l7 7" />
  </Svg>
)

export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconCheck = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const IconCompare = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 3v18" />
    <path d="M12 5h9v14h-9" fill="currentColor" fillOpacity="0.35" stroke="none" />
  </Svg>
)

export const IconCamera = () => (
  <Svg>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.8" />
  </Svg>
)

export const IconMagic = () => (
  <Svg>
    <path d="m4 20 11-11" />
    <path d="m13 7 2-2 4 4-2 2z" />
    <path d="M8 3v3M6.5 4.5h3M19 14v3M17.5 15.5h3" />
  </Svg>
)

export const IconCollage = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M11 3v18M11 12h10" />
  </Svg>
)

export const IconIdPhoto = () => (
  <Svg>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <circle cx="12" cy="10" r="2.8" />
    <path d="M7.5 18c.8-2.3 2.4-3.4 4.5-3.4s3.7 1.1 4.5 3.4" />
  </Svg>
)

export const IconRecipe = () => (
  <Svg>
    <path d="M6 3h9l3 3v15H6z" />
    <path d="M9 10h6M9 14h6M9 18h3" />
  </Svg>
)

export const IconText = () => (
  <Svg>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Svg>
)

export const IconSticker = () => (
  <Svg>
    <path d="M20 12a8 8 0 1 1-8-8h3.5L20 8.5Z" />
    <path d="M15.5 4v4.5H20" />
    <path d="M9 13.5c1.6 1.5 4.4 1.5 6 0M9.5 10h.01M14.5 10h.01" />
  </Svg>
)

export const IconFrame = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </Svg>
)

export const IconMosaic = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    <path d="M3 3h6v6H3zM15 9h6v6h-6zM9 15h6v6H9z" fill="currentColor" fillOpacity="0.5" stroke="none" />
  </Svg>
)

export const IconBrush = () => (
  <Svg>
    <path d="M20 4 10.5 13.5" />
    <path d="M10.5 13.5c-2.5-.8-5 .7-5 3.5 0 1.5-1 2.5-2.5 3 3.5 1 8 .5 8.5-3.5" />
  </Svg>
)

export const IconEraser = () => (
  <Svg>
    <path d="m14 4 6 6-9 9H6l-3-3z" />
    <path d="m9 9 6 6M11 19h10" />
  </Svg>
)

export const IconBlur = () => (
  <Svg>
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="7" strokeDasharray="2 2.5" />
    <circle cx="12" cy="12" r="10" strokeDasharray="1 3" />
  </Svg>
)

export const IconCutout = () => (
  <Svg>
    <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" />
    <circle cx="12" cy="9.5" r="2.5" />
    <path d="M7.5 17c.9-2.4 2.5-3.6 4.5-3.6s3.6 1.2 4.5 3.6" />
  </Svg>
)

export const IconHD = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9v6M7 12h3M10 9v6M13.5 9v6h1.5a3 3 0 0 0 0-6z" />
  </Svg>
)

export const IconPortrait = () => (
  <Svg>
    <circle cx="12" cy="9" r="4" />
    <path d="M5 21c.8-4 3.5-6 7-6s6.2 2 7 6" />
    <path d="M18 3.5v3M16.5 5h3" />
  </Svg>
)

export const IconWand = () => (
  <Svg>
    <circle cx="11" cy="13" r="7.5" />
    <path d="M8 15.5c1.6 1.4 4.4 1.4 6 0M8.5 11h.01M13.5 11h.01" strokeWidth="2.2" />
    <path d="M19 2v3M17.5 3.5h3M21 7.5v2M20 8.5h2" />
  </Svg>
)

export const IconSpot = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="14.5" cy="14" r="1.6" fill="currentColor" />
    <path d="m16 5 3 3" />
  </Svg>
)

export const IconFaceShape = () => (
  <Svg>
    <path d="M12 3c4 0 6.5 3 6.5 7.5 0 5-3.5 10.5-6.5 10.5S5.5 15.5 5.5 10.5C5.5 6 8 3 12 3Z" />
    <path d="M3 12h2.5M18.5 12H21M3.5 10l2 2-2 2M20.5 10l-2 2 2 2" />
  </Svg>
)

export const IconBody = () => (
  <Svg>
    <circle cx="12" cy="4.5" r="2" />
    <path d="M9 8.5h6l-1 6h-4z" />
    <path d="M10 14.5 9 21M14 14.5l1 6.5M5 9.5h2M17 9.5h2" />
  </Svg>
)

export const IconLipstick = () => (
  <Svg>
    <path d="M9 21V11h6v10z" />
    <path d="M10 11V6l4-3v8" />
    <path d="M8 15h8" />
  </Svg>
)

export const IconEye = () => (
  <Svg>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IconTooth = () => (
  <Svg>
    <path d="M7.5 3.5c1.6 0 2.8.8 4.5.8s2.9-.8 4.5-.8C19 3.5 20.5 5.5 20 9c-.4 3-1.4 4.5-1.9 7.5-.4 2.6-1 4.5-2.2 4.5-1.6 0-1.4-5.5-3.9-5.5S9.7 21 8.1 21c-1.2 0-1.8-1.9-2.2-4.5C5.4 13.5 4.4 12 4 9c-.5-3.5 1-5.5 3.5-5.5Z" />
  </Svg>
)

export const IconHeight = () => (
  <Svg>
    <path d="M12 3v18M8.5 6.5 12 3l3.5 3.5M8.5 17.5 12 21l3.5-3.5" />
    <path d="M4 3h3M4 21h3" />
  </Svg>
)

export const IconHair = () => (
  <Svg>
    <path d="M5 20c-1-6 .5-11 3.5-13.5S16 4 18 7s1.5 8 1 13" />
    <path d="M8.5 20c-.5-4 0-7.5 3.5-10 1.5 3 4 4 5.5 4.5" />
  </Svg>
)
