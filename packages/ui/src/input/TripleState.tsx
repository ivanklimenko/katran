import { k } from '@katran/tokens'
import { ButtonBase } from '../button/Button'
import { useStableId } from '../compat/useStableId'
import { Icon, type IconName } from '../icon'
import { styled } from '../styled'
import { Tooltip } from '../tooltip'

export type TripleStateValue = 'unset' | 'on' | 'off'

export type TripleStateProps = {
  value: TripleStateValue
  onChange: (value: TripleStateValue) => void
  icon: IconName
  label: string
  hints: Record<TripleStateValue, string>
  disabled?: boolean
  className?: string
}

const nextState: Record<TripleStateValue, TripleStateValue> = { unset: 'on', on: 'off', off: 'unset' }

const Control = styled(ButtonBase)`
  &:where([data-state='unset']) {
    background: ${k.chip};
    color: ${k.muted};
  }

  &:where([data-state='on']) {
    background: ${k.okSoft};
    color: ${k.ok};
  }

  &:where([data-state='off']) {
    background: ${k.badSoft};
    color: ${k.bad};
  }
`

export function TripleState({ value, onChange, icon, label, hints, disabled, className }: TripleStateProps) {
  const descriptionId = useStableId()
  const hint = hints[value]

  return (
    <>
      <Tooltip content={hint}>
        <Control
          type="button" data-icon="" data-size="m" data-state={value} className={className}
          aria-label={label} aria-describedby={descriptionId} data-k-tip-described="" disabled={disabled}
          onClick={() => onChange(nextState[value])}
        >
          <Icon name={icon} size="s" />
        </Control>
      </Tooltip>
      <span id={descriptionId} hidden>{hint}</span>
    </>
  )
}
