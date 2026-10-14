/** pending — правка ждёт утверждения, confirmed — утверждена, rejected — отклонена второй рукой. */
export type EditStatus = 'pending' | 'confirmed' | 'rejected'
export type EditMarkProps = {
  /** Доступное имя и тултип: что изменено, кем и когда. */
  tip: string
  /** Без статуса — только точка; со статусом под точкой галочка, видимая лишь у confirmed; у rejected точка цвета bad. */
  status?: EditStatus | undefined
  /** Класс потребителя на корне (styled(X)). */
  className?: string | undefined
}

/**
 * Маркер «изменено» рядом со значением (эталон .hero .vd .mark, index.html:149–153): точка warn,
 * под ней галочка — цвета ok у утверждённой правки, у ожидающей место держится (visibility: hidden).
 * Картинка с именем: смысл — в tip, содержимое декоративное.
 */
export function EditMark({ tip, status, className }: EditMarkProps) {
  return (
    <span role="img" aria-label={tip} data-k-tip={tip} data-status={status} className={className ? `k-mark ${className}` : 'k-mark'}>
      <span className="k-mark-dot" />
      {status && <span className="k-mark-ok">✓</span>}
    </span>
  )
}
