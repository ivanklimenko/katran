import { render } from 'react-dom'
import '@katran/tokens/fonts.css'
import { App } from './App'

// Демо — на React 17, как прод: хост метаприложения отдаёт React 17, корень там монтирует хост.
// createRoot (react-dom/client) появился в 18; здесь legacy-корень ReactDOM.render
// (без автоматического батчинга вне обработчиков React — так же, как в проде).
render(<App />, document.getElementById('root'))
