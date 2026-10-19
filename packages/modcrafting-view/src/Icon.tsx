// Inline SVG icons used by the standalone browser workbench.
import React from 'react'

export interface IconProps extends React.SVGAttributes<SVGElement> {
  size?: 'sm' | 'md' | 'lg'
}

function IconBase({ size = 'md', className = '', children, ...rest }: IconProps & { children: React.ReactNode }) {
  const sizeClass = size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : ''
  return (
    <svg
      className={`icon ${sizeClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconFolder = (props: IconProps) => (
  <IconBase {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></IconBase>
)

export const IconWrench = (props: IconProps) => (
  <IconBase {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></IconBase>
)

export const IconGamepad = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
  </IconBase>
)

export const IconPlay = (props: IconProps) => (
  <IconBase {...props}><polygon points="5 3 19 12 5 21 5 3" /></IconBase>
)
export const IconSquare = (props: IconProps) => (
  <IconBase {...props}><rect x="6" y="6" width="12" height="12" rx="1" /></IconBase>
)
