import { k } from '@katran/tokens'
import { styled } from '../styled'
import { fieldFocusRing } from './parts'

export type RadioOption = { value: string; label: string; disabled?: boolean }

export type RadioGroupProps = {
  label: string
  name: string
  value: string | null
  options: RadioOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const Root = styled.div`
  display: grid;
  justify-items: start;
  gap: ${k.sp2};
`

const Option = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
  color: ${k.ink};
  font: 400 ${k.fs1} / ${k.lh1} ${k.sans};
  cursor: pointer;

  &:where([data-disabled]) {
    color: ${k.muted};
    cursor: default;
  }
`

const Control = styled.input`
  appearance: none;
  box-sizing: border-box;
  flex: none;
  width: ${k.dotM};
  height: ${k.dotM};
  margin: 0;
  border: 1px solid ${k.line};
  border-radius: 50%;
  background: ${k.paper};
  box-shadow: inset 0 0 0 1px ${k.faint};
  cursor: inherit;

  &:checked {
    background: radial-gradient(circle closest-side, ${k.val} 100%, transparent) center / ${k.dotS} ${k.dotS} no-repeat ${k.paper};
  }

  &:focus-visible {
    ${fieldFocusRing}
  }

  &:disabled {
    opacity: 0.5;
  }

  @media (forced-colors: active) {
    appearance: auto;
  }
`

export function RadioGroup({ label, name, value, options, onChange, disabled, className }: RadioGroupProps) {
  return (
    <Root role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={className}>
      {options.map((option) => {
        const isDisabled = disabled || option.disabled
        return (
          <Option key={option.value} data-disabled={isDisabled || undefined}>
            <Control
              type="radio" name={name} value={option.value} checked={value === option.value} disabled={isDisabled}
              onChange={(event) => onChange(event.currentTarget.value)}
            />
            <span>{option.label}</span>
          </Option>
        )
      })}
    </Root>
  )
}
