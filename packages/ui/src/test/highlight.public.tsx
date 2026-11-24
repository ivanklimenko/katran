import { Highlight, type HighlightProps } from '../index'

const props: HighlightProps = { text: 'SWIFT и Swift', query: 'swift', className: 'match' }
export const highlight = <Highlight {...props} />

// @ts-expect-error Запрос должен быть строкой.
export const invalidHighlight = <Highlight {...props} query={42} />
