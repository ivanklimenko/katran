import { createGlobalStyle } from 'styled-components'
import { k } from '@katran/tokens'
import { CopyValue, FieldTag } from '@katran/ui'
import { FX_FIELDS } from '../model/swift'
import type { SwiftValue } from '../model/detail'

export function swiftTooltip(tag: string, field: SwiftValue): string {
  const width = FX_FIELDS[tag]?.width ?? 35
  const chunk = new RegExp(`.{1,${width}}`, 'gu')
  const lines = field.acc ? [`/${field.acc}`, ...field.lines] : field.lines
  return lines.flatMap((line) => line.split('\n').flatMap((part) => part.match(chunk) ?? [''])).join('\n')
}

export function SwiftTextFields({ fields, tabIndex }: { fields: Partial<Record<'70' | '72', SwiftValue>>; tabIndex?: number }) {
  return (
    <div className="fxTextFields">
      {(['70', '72'] as const).map((tag) => {
        const field = fields[tag]
        if (!field?.lines.some(Boolean)) return null
        return (
          <div className="fxTextField" key={tag}>
            <FieldTag tag={tag} title={FX_FIELDS[tag]?.label} />
            <CopyValue value={field.lines.join('\n')} display={field.lines.join(' ')} tooltip={swiftTooltip(tag, field)}
              tone="ink2" size="s" tabIndex={tabIndex} className="fxTextValue" />
          </div>
        )
      })}
    </div>
  )
}

export const SwiftTextFieldStyles = createGlobalStyle`
  :where([data-k-root]) .fxTextFields {
    display: flex;
    gap: ${k.sp3};
  }

  :where([data-k-root]) .fxTextField {
    display: flex;
    flex: 1 1 0;
    align-items: baseline;
    gap: ${k.sp1};
    min-width: 0;
  }

  :where([data-k-root]) .fxTextField .fxTextValue {
    min-width: 0;
    margin-inline: 0;
  }
`
