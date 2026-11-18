import { useState } from 'react'
import { render } from 'react-dom'
import { k } from '@katran/tokens'
import { Icon, IconButton, Input, KatranFonts, KatranProvider, Link, Spinner, Text, Textarea } from '@katran/ui'

const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const density = params.get('density') === '1.25' ? 1.25 : 1

function Primitives() {
  const [clicks, setClicks] = useState(0)
  const [comment, setComment] = useState('')
  return (
    <KatranProvider theme={theme} density={density}>
      <KatranFonts />
      <div style={{ color: k.val }}>
        <Icon name="search" size="s" label="Поиск" />
        <Icon name="loading" label="Знак загрузки" />
      </div>
      <IconButton name="edit" label="Правка" onClick={() => setClicks((count) => count + 1)} />
      <IconButton name="form-action" label="Свой знак"><span>+</span></IconButton>
      <output aria-label="Число кликов">{clicks}</output>
      <div>
        <Spinner size="s" label="Загрузка S" />
        <Spinner />
        <Spinner size="l" label="Загрузка L" />
      </div>
      <div data-testid="spinner-panel" style={{ width: k.sp8, height: k.sp8 }}>
        <Spinner block label="Загрузка панели" />
      </div>
      <section data-testid="text-samples" style={{ backgroundColor: k.paper }}>
        <Text>Основной текст <Text variant="subhead" as="p">Внутри абзаца</Text></Text>
        <Text variant="subhead">Подзаголовок</Text>
        <Text variant="caption" tone="ink2">Подпись</Text>
        <Text variant="meta" tone="muted">Метаданные</Text>
        <Text variant="inline" weight="bold">Выделение</Text>
      </section>
      <section data-testid="link-samples" style={{ backgroundColor: k.paper }}>
        <Text>Открыть <Link href="#link-target">пример перехода</Link>.</Text>
        <Text variant="caption">Скачать <Link href="data:text/plain,katran" download="katran.txt">пример файла</Link>.</Text>
        <p id="link-target">Цель перехода</p>
      </section>
      <section aria-label="Поля ввода">
        <Textarea aria-label="Комментарий" value={comment} onChange={(event) => setComment(event.currentTarget.value)} />
        <Input aria-label="Однострочное поле" />
        <Textarea aria-label="Невалидный комментарий" size="s" rows={2} invalid defaultValue="Укажите причину" />
        <button type="button" onClick={() => setComment('Готовый\nответ')}>Подставить комментарий</button>
      </section>
    </KatranProvider>
  )
}

render(<Primitives />, document.getElementById('root'))
