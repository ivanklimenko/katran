import { render } from 'react-dom'
import '@katran/tokens/fonts.css'
import { KatranProvider } from '@katran/ui'

// Временная заглушка до Task 11: страница «Реестры ПИ» появится позже.
// React 17, как хост метаприложения — legacy-корень ReactDOM.render (createRoot нет в 17).
render(
  <KatranProvider storageKey="katran-pi"><p>Реестры ПИ</p></KatranProvider>,
  document.getElementById('root'),
)
