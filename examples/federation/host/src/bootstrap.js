import React from 'react'
import ReactDOM from 'react-dom'
import * as effector from 'effector'

// Отладочный маркер макета: проверка «React/effector в рантайме один» сравнением модулей.
window.__katranExample = Object.assign(window.__katranExample || {}, { hostReact: React, hostReactDom: ReactDOM, hostEffector: effector })

// Единица хоста, которую он передаёт встроенному экрану (как это делает метаприложение: пользователь, контекст канала).
var visit = effector.createEvent()
var $visits = effector.createStore(0).on(visit, function (n) { return n + 1 })
window.__katranExample.hostUnits = { $visits: $visits, visit: visit }

var DocumentsScreen = React.lazy(function () { return import('katranRemote/DocumentsScreen') })

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error: error } }
  render() {
    if (this.state.error) return React.createElement('pre', { role: 'alert', 'data-host-error': '' }, String(this.state.error && this.state.error.stack || this.state.error))
    return this.props.children
  }
}

function useStore(store) {
  var s = React.useState(store.getState())
  React.useEffect(function () { return store.watch(function (v) { s[1](v) }) }, [store])
  return s[0]
}

function App() {
  var visits = useStore($visits)
  // Уход со страницы и возврат: remote размонтируется и монтируется заново.
  var shown = React.useState(true)
  return (
    <div>
      <header className="host-header">
        <h1>Метаприложение</h1>
        <nav><a href="#docs">Валютные документы</a></nav>
        <button type="button" data-host-visit="" onClick={function () { visit() }}>Хост: событие ({visits})</button>
        <button type="button" data-host-toggle="" onClick={function () { shown[1](!shown[0]) }}>{shown[0] ? 'Скрыть экран' : 'Показать экран'}</button>
      </header>
      <main className="host-main">
        <p>Таблица хоста с фокусируемой ячейкой — проверка, что стили кита не протекают на разметку хоста.</p>
        <table className="host-table"><tbody><tr><td tabIndex={0} data-host-cell="">ячейка хоста</td><td>ещё</td></tr></tbody></table>
        <div className="host-slot" data-host-slot="">
          <Boundary>
            <React.Suspense fallback={<p>Загрузка экрана…</p>}>
              {shown[0] && <DocumentsScreen $visits={$visits} visit={visit} />}
            </React.Suspense>
          </Boundary>
        </div>
      </main>
    </div>
  )
}

// ?bare — без глобальных стилей хоста (эталон для сравнения геометрии).
var hostStyles = location.search.indexOf('bare') < 0 ? import('./host.css') : Promise.resolve()
hostStyles.then(function () { ReactDOM.render(<App />, document.getElementById('root')) })
