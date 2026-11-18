import { k } from '@katran/tokens'
import { styled } from '../styled'

const glyphs = {
  plus: <path d="M8 3v10M3 8h10" />,
  edit: <path d="m3 10 7.5-7.5 3 3L6 13l-3 1zM9.5 3.5l3 3" />,
  delete: <path d="M2 4h12M6 4V2h4v2M4 4l.7 10h6.6L12 4M6.5 7v4m3-4v4" />,
  alert: <path d="M8 2 1.5 13h13zM8 6v2.5M8 11h.01" />,
  error: <><circle cx="8" cy="8" r="6" /><path d="m6 6 4 4m0-4-4 4" /></>,
  success: <><circle cx="8" cy="8" r="6" /><path d="m5 8 2 2 4-4" /></>,
  clock: <><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></>,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10 10 3.5 3.5" /></>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11m0-6h.01" /></>,
  doc: <path d="M4 2h5l3 3v9H4zM9 2v3h3M6 8h4m-4 2.5h4" />,
  enter: <path d="M13 3v5H3m3-3L3 8l3 3" />,
  drag: <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" strokeWidth="2" />,
  'arrow-up': <path d="M8 13V3M4 7l4-4 4 4" />,
  'arrow-down': <path d="M8 3v10m-4-4 4 4 4-4" />,
  monitoring: <path d="M2 3h12v9H2zM6 14h4M3.5 8h2L7 5.5 9 9l1.5-2H13" />,
  link: <path d="m6.5 9.5 3-3m-4 .5-2 2a2.5 2.5 0 0 0 3.5 3.5l2-2m-2-5 2-2a2.5 2.5 0 0 1 3.5 3.5l-2 2" />,
  settings: <><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2m9 0h2M3.4 3.4l1.4 1.4m6.4 6.4 1.4 1.4m-9.2 0 1.4-1.4m6.4-6.4 1.4-1.4" /></>,
  check: <path d="m3 8 3.5 3.5L13 5" />,
  refresh: <path d="M13.5 7A5.5 5.5 0 1 0 13 11M13.5 3v4h-4" />,
  copy: <path d="M6 6h7v8H6zM10 4V2H3v9h1" />,
  'view-on': <><path d="M1.5 8S4 4 8 4s6.5 4 6.5 4S12 12 8 12 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.75" /></>,
  'show-menu': <path d="M3 4h10M3 8h10M3 12h10" />,
  loading: <path d="M8 2.5A5.5 5.5 0 1 1 2.5 8" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
  'chevron-up': <path d="m4 10 4-4 4 4" />,
  'chevron-down': <path d="m4 6 4 4 4-4" />,
  filter: <path d="M2 3h12L9.5 8.5V12l-3 1V8.5z" />,
  cross: <path d="m4 4 8 8m0-8-8 8" />,
  widget: <path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />,
  'clip-add': <><path d="m9 3-6 6a2.8 2.8 0 0 0 4 4l2-2M8.5 6.5l-3.7 3.7" /><path d="M11.5 3.5v5m-2.5-2.5h5" /></>,
}

export type IconName = keyof typeof glyphs

export type IconProps = {
  name: IconName
  size?: 's' | 'm' | undefined
  label?: string | undefined
  className?: string | undefined
}

const Root = styled.svg`
  display: inline-block;
  flex-shrink: 0;
  width: ${k.iconM};
  height: ${k.iconM};
  vertical-align: middle;

  &:where([data-size='s']) {
    width: ${k.iconS};
    height: ${k.iconS};
  }
`

export function Icon({ name, size = 'm', label, className }: IconProps) {
  const accessibility = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }
  return (
    <Root
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-size={size}
      className={className}
      {...accessibility}
    >
      {glyphs[name]}
    </Root>
  )
}
