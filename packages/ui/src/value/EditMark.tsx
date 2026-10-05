import s from './Value.module.css'

/** pending — правка ждёт утверждения, confirmed — утверждена. */
export type EditStatus = 'pending' | 'confirmed'
export type EditMarkProps = {
  /** Доступное имя и тултип: что изменено, кем и когда. */
  tip: string
  /** Без статуса — только точка; со статусом под точкой галочка, видимая лишь у confirmed. */
  status?: EditStatus | undefined
}

/**
 * Маркер «изменено» рядом со значением (эталон .hero .vd .mark, index.html:149–153): точка warn,
 * под ней галочка — цвета ok у утверждённой правки, у ожидающей место держится (visibility: hidden).
 * Картинка с именем: смысл — в tip, содержимое декоративное.
 */
export function EditMark({ tip, status }: EditMarkProps) {
  return (
    <span role="img" aria-label={tip} data-k-tip={tip} data-status={status} className={s.mark}>
      <span className={s.markDot} />
      {status && <span className={s.markOk}>✓</span>}
    </span>
  )
}
