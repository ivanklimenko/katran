import { useState } from 'react'
import { render } from 'react-dom'
import { k } from '@katran/tokens'
import { Icon, IconButton, KatranProvider, Spinner } from '@katran/ui'

const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const density = params.get('density') === '1.25' ? 1.25 : 1

function Primitives() {
  const [clicks, setClicks] = useState(0)
  return (
    <KatranProvider theme={theme} density={density}>
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
    </KatranProvider>
  )
}

render(<Primitives />, document.getElementById('root'))
