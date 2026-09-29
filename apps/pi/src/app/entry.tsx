import { render } from 'react-dom'
import '@katran/tokens/fonts.css'
import './transport'
import { App } from './App'

// Приложение — на React 17, как прод: хост метаприложения отдаёт React 17, корень там монтирует хост.
// createRoot (react-dom/client) появился в 18; здесь legacy-корень ReactDOM.render
// (без автоматического батчинга вне обработчиков React — так же, как в проде).
// ?hostile — глобальные стили «враждебного хоста» (public/hostile.css): проверка изоляции кита (спека совместимости 2.3).
if (new URLSearchParams(location.search).has('hostile')) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${import.meta.env.BASE_URL}hostile.css`
  document.head.appendChild(link)
}

render(<App />, document.getElementById('root'))
