import { k } from '@katran/tokens'
import { css, keyframes, styled } from '../styled'

const slideFrames = css`
  to {
    left: 100%;
  }
`
const slide = keyframes`${slideFrames}`

const Track = styled.div`
  position: relative;
  height: ${k.progress};
  overflow: hidden;
  background: ${k.valSoft};
`

const Fill = styled.span`
  position: absolute;
  inset: 0 auto 0 -40%;
  width: 40%;
  background: ${k.val};
  animation: ${slide} 1.1s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    width: 100%;
    left: 0;
    opacity: 0.4;
  }
`

export function ProgressBar({ label, className }: { label: string; className?: string | undefined }) {
  return <Track role="progressbar" aria-label={label} className={className}><Fill /></Track>
}
