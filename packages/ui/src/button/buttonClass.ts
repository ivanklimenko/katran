import s from './Button.module.css'

/** Классы кнопки по варианту и размеру — общие для Button и ButtonLink (один CSS-модуль). */
export function buttonClass(variant: 'primary' | 'ghost', size: 's' | 'm' | 'l', className: string | undefined): string {
  return [s.button, s[variant], s[`size${size.toUpperCase()}`], className].filter(Boolean).join(' ')
}
