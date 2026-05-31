interface P {
  size?: number
  className?: string
}
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
})

export const HomeIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
)
export const DocsIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6" />
  </svg>
)
export const PlusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const StudyIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4a4 4 0 0 0-4 4c0 1.3.6 2.4 1.5 3.1A4 4 0 0 0 8 14.5 4 4 0 0 0 12 19a4 4 0 0 0 4-4.5 4 4 0 0 0-1.5-3.4A4 4 0 0 0 16 8a4 4 0 0 0-4-4Z" />
    <path d="M12 4v15" />
  </svg>
)
export const GraphIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="7" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="17" r="2.4" />
    <path d="M7.6 8.4 10.6 15M16.7 7.6 13.2 15" />
  </svg>
)
export const CameraIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
)
export const FileIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4" />
  </svg>
)
export const PasteIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
  </svg>
)
export const ChevronRight = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)
export const ChevronLeft = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)
export const PinIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 3h6l-1 7 3 3H7l3-3-1-7Z" />
    <path d="M12 16v5" />
  </svg>
)
export const TrashIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
  </svg>
)
export const SettingsIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
)
export const SunIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
)
export const MoonIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </svg>
)
export const HintIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3Z" />
  </svg>
)
export const EditIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </svg>
)
export const SuspendIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9v6M15 9v6" />
  </svg>
)
