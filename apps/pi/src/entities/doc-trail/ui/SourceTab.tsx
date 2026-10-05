import { CodeView, Disclosure } from '@katran/ui'
import type { SourceTexts } from '../model/types'
import { accordionOf, charsLabel, codeLanguage, type TrailTabProps } from './lib'
import { HeadNote, TrailEmpty } from './parts'
import s from './trail.module.css'

/**
 * Вкладки «Исходный текст» (валюта) и «ED244» (рубль) — эталон sourceHtml, index.html:1246: аккордеон на ключ,
 * длина в заголовке; XML, если текст начинается с «<», иначе SWIFT. Пустой ключ не раскрывается.
 * По умолчанию раскрыты все непустые (спека 2b §3.3).
 */
export function SourceTab({ data, ctx }: TrailTabProps<SourceTexts>) {
  const names = Object.keys(data)
  if (!names.length) return <TrailEmpty text="Исходного текста нет" />
  const accordion = accordionOf(ctx, names.filter((k) => Boolean(data[k])))
  return (
    <div className={s.stack}>
      {names.map((name) => {
        const text = data[name] ?? ''
        if (!text) return <Disclosure key={name} title={name} mono empty emptyText="нет" />
        return (
          <Disclosure key={name} title={name} mono aside={<HeadNote>{charsLabel(text)}</HeadNote>} {...accordion(name)}>
            <CodeView code={text} language={codeLanguage(text)} label={name} />
          </Disclosure>
        )
      })}
    </div>
  )
}
