import { useEffect, useRef, type CSSProperties } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'
import { fieldFocusRing } from './parts'

export type SliderProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

const SliderBox = styled.div`
  display: grid;
  gap: ${k.sp1};
  min-width: 0;
`

const SliderControl = styled.input`
  appearance: none;
  display: block;
  width: 100%;
  height: ${k.iconM};
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: ${k.rS};
  background: transparent;
  cursor: pointer;

  &:focus-visible {
    ${fieldFocusRing}
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &::-webkit-slider-runnable-track {
    height: ${k.sp1};
    border-radius: ${k.rS};
    background: linear-gradient(to right, ${k.val} var(--k-slider), ${k.line} var(--k-slider));
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: ${k.iconM};
    height: ${k.iconM};
    margin-top: calc((${k.sp1} - ${k.iconM}) / 2);
    border: 0;
    border-radius: 50%;
    background: ${k.val};
  }
`

const CurrentValue = styled.span`
  color: ${k.ink};
  font: 400 ${k.fs1} / ${k.lh1} ${k.sans};
`

const Limits = styled.span`
  display: flex;
  justify-content: space-between;
  color: ${k.muted};
  font: 400 ${k.fs3} / ${k.lh3} ${k.sans};
`

function decimal(number: number) {
  const [mantissa = '', exponent = '0'] = String(number).split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  return { coefficient: BigInt(whole + fraction), places: fraction.length - Number(exponent) }
}

function sliderPosition(min: number, max: number, step: number, value: number) {
  if (min === max) return { value: min, fill: '0%' }

  // Целые числа в общем десятичном масштабе сохраняют точные границы и шаг (например, 0.1 → 0.3).
  const lower = decimal(min)
  const upper = decimal(max)
  const increment = decimal(step)
  const input = decimal(Math.min(max, Math.max(min, value)))
  const places = Math.max(lower.places, upper.places, increment.places, input.places)
  const integer = (part: ReturnType<typeof decimal>) => part.coefficient * 10n ** BigInt(places - part.places)

  const start = integer(lower)
  const span = integer(upper) - start
  const stride = integer(increment)
  const offset = integer(input) - start
  const lastStep = span / stride
  const nearest = (2n * offset + stride) / (2n * stride)
  const position = (nearest > lastStep ? lastStep : nearest) * stride
  const percent = Number((1_000_000n * position + span / 2n) / span) / 10_000

  return { value: Number((start + position) + 'e' + -places), fill: percent + '%' }
}

export function Slider({ label, value, onChange, min, max, step = 1, disabled, className }: SliderProps) {
  const lower = Number.isFinite(min) ? min : 0
  const upper = Number.isFinite(max) ? Math.max(lower, max) : lower
  const stride = Number.isFinite(step) && step > 0 ? step : 1
  const { value: current, fill } = sliderPosition(lower, upper, stride, Number.isFinite(value) ? value : lower)
  const lastCorrection = useRef<{ value: number; current: number } | null>(null)

  useEffect(() => {
    const previous = lastCorrection.current
    if (previous !== null && Object.is(previous.value, value) && previous.current === current) return
    lastCorrection.current = null
    if (disabled || current === value) return
    lastCorrection.current = { value, current }
    onChange(current)
  }, [current, disabled, onChange, value])

  const style: CSSProperties & { '--k-slider': string } = { '--k-slider': fill }
  return (
    <SliderBox className={className} style={style}>
      <CurrentValue>{current}</CurrentValue>
      <SliderControl
        type="range"
        aria-label={label}
        min={lower}
        max={upper}
        step={stride}
        value={current}
        disabled={disabled}
        onChange={(event) => {
          const input = event.currentTarget.valueAsNumber
          if (disabled || !Number.isFinite(input)) return
          const next = sliderPosition(lower, upper, stride, input).value
          if (next !== current) onChange(next)
        }}
      />
      <Limits><span>{lower}</span><span>{upper}</span></Limits>
    </SliderBox>
  )
}
