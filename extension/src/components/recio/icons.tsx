/**
 * Vyooom icon set — clean stroked line icons (24×24 viewBox, round caps/joins,
 * 1.7 stroke) plus the capture-reticle logomark. Ported from the design handoff
 * (`recio-icons.jsx`) to typed React components. All take a `size`/`sw` prop and
 * inherit `currentColor`.
 */
import type { CSSProperties, ReactNode } from "react";

export type IconProps = {
  size?: number;
  sw?: number;
  style?: CSSProperties;
  className?: string;
};

function Svg({
  size = 20,
  sw = 1.7,
  children,
  style,
  className,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {children}
    </svg>
  );
}

/** The Vyooom logomark: a capture reticle (framing knowledge). */
export function ReticleMark({
  size = 22,
  sw = 2,
  dot = true,
  color = "currentColor",
  live = false,
  style,
}: {
  size?: number | string;
  sw?: number;
  dot?: boolean;
  color?: string;
  live?: boolean;
  style?: CSSProperties;
}) {
  const off = 3.5;
  const len = 6.5;
  const e = 24 - off;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", ...style }}
    >
      <path d={`M${off} ${off + len} V${off} H${off + len}`} />
      <path d={`M${e - len} ${off} H${e} V${off + len}`} />
      <path d={`M${e} ${e - len} V${e} H${e - len}`} />
      <path d={`M${off + len} ${e} H${off} V${e - len}`} />
      {dot && <circle cx="12" cy="12" r={live ? 2.6 : 2.1} fill={color} stroke="none" />}
    </svg>
  );
}

export const Icons = {
  Reticle: (p: IconProps & { dot?: boolean; live?: boolean; color?: string }) => (
    <ReticleMark {...p} />
  ),
  Screen: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7M12 17.5v3" />
    </Svg>
  ),
  Cam: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10l5-2.6v9.2l-5-2.6" />
    </Svg>
  ),
  Combo: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <circle cx="7.5" cy="13.5" r="3.2" fill="currentColor" stroke="none" opacity=".18" />
      <circle cx="7.5" cy="13.5" r="3.2" />
    </Svg>
  ),
  Mic: (p: IconProps) => (
    <Svg {...p}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7" />
    </Svg>
  ),
  MicOff: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 5.2A3 3 0 0 1 15 6v4M15 13.3a3 3 0 0 1-4.4 1.3M5.5 11a6.5 6.5 0 0 0 10 5.4M12 17.5v4M8.5 21.5h7M3.5 3.5l17 17" />
    </Svg>
  ),
  Shot: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7.5 2.5v5M2.5 7.5h5M16.5 21.5v-5M21.5 16.5h-5" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
    </Svg>
  ),
  Pen: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15.5 4.5l4 4M4 20l1.2-4.2L16 5a2 2 0 0 1 3 3L8.2 18.8 4 20Z" />
    </Svg>
  ),
  Share: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 14.5V3.5M8.5 7L12 3.5 15.5 7" />
      <path d="M5.5 12.5v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6" />
    </Svg>
  ),
  Play: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7.5 5.5l11 6.5-11 6.5Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Pause: (p: IconProps) => (
    <Svg {...p}>
      <rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Stop: (p: IconProps) => (
    <Svg {...p}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Restart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5" />
    </Svg>
  ),
  Gear: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7L17 17M7 7L5.3 5.3" />
    </Svg>
  ),
  More: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  X: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
    </Svg>
  ),
  ChevR: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  ),
  ChevD: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  ),
  ArrowR: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Svg>
  ),
  Folder: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Link: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9.5 14.5l5-5M8 12.5l-2 2a3.2 3.2 0 0 0 4.5 4.5l2-2M16 11.5l2-2a3.2 3.2 0 0 0-4.5-4.5l-2 2" />
    </Svg>
  ),
  Copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5v11M8 11l4 4 4-4M4.5 19.5h15" />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 6.5h15M9 6.5V5a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5v1.5M6.5 6.5l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
    </Svg>
  ),
  Cloud: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 18.5a4.2 4.2 0 0 1-.3-8.4 5.3 5.3 0 0 1 10.2-1.1A3.9 3.9 0 0 1 17.5 18.5Z" />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 2.8l7 2.6v5.4c0 4.4-3 7.8-7 9.4-4-1.6-7-5-7-9.4V5.4Z" />
      <path d="M9 11.8l2 2 4-4.2" />
    </Svg>
  ),
  Comment: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4a2 2 0 0 1-1-1.7Z" />
    </Svg>
  ),
  Grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </Svg>
  ),
  Stream: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6.5h16M4 12h16M4 17.5h10" />
    </Svg>
  ),
  Trim: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="6.5" cy="7" r="2.4" />
      <circle cx="6.5" cy="17" r="2.4" />
      <path d="M8.6 8.4L19 17M8.6 15.6L19 7" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  ),
  Fullscreen: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 9V4.5h4.5M20 9V4.5h-4.5M4 15v4.5h4.5M20 15v4.5h-4.5" />
    </Svg>
  ),
  Drag: (p: IconProps) => (
    <Svg {...p}>
      {[6, 12, 18].flatMap((cy) =>
        [9, 15].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" stroke="none" />
        )),
      )}
    </Svg>
  ),
  Blur: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="2.2 3" />
      <circle cx="12" cy="12" r="3.4" />
    </Svg>
  ),
  Bolt: (p: IconProps) => (
    <Svg {...p}>
      <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12Z" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </Svg>
  ),
  Globe: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5S14.4 18.2 12 20.5C9.6 18.2 8.4 15.2 8.4 12S9.6 5.8 12 3.5Z" />
    </Svg>
  ),
  Users: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.4a5.5 5.5 0 0 1 3 5.1" />
    </Svg>
  ),
  Speed: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 18a8 8 0 1 1 14 0" />
      <path d="M12 14l3.5-3.5" />
    </Svg>
  ),
  Sound: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4Z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5Z" />
    </Svg>
  ),
  Monitor: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20.5h6M12 16.5v4" />
    </Svg>
  ),
};

export type IconName = keyof typeof Icons;
export type IconComponent = (p: IconProps) => ReactNode;
