import * as React from 'react'

// Стабильный id элемента для связок aria-controls / htmlFor / aria-describedby.
// React.useId есть только с React 18; кит обязан работать и на React 17
// (хост метаприложения отдаёт 17 как shared singleton через федерацию).
// Выбор делается один раз при загрузке модуля: версия React в рантайме не меняется,
// поэтому порядок хуков в компоненте стабилен и правила хуков не нарушаются.
// Фолбэк — счётчик модуля в ленивом useState: id назначается при первом рендере
// экземпляра и не меняется. SSR и гидратацию кит не поддерживает, поэтому
// расхождение id сервера и клиента для фолбэка неважно.
// Доступ через индекс, а не `import { useId }`: у React 17 такого экспорта нет,
// и сборщик потребителя (webpack/MF) не должен ругаться на отсутствующий именованный экспорт.
const nativeUseId = (React as unknown as { useId?: () => string })['useId']

// Префикс экземпляра модуля: при федерации на странице могут оказаться две копии кита
// (разные remote-приложения со своим @katran/ui), и у каждой свой счётчик с единицы —
// без префикса обе выдали бы одинаковые id и связки aria/htmlFor перепутались бы.
const prefix = `k${Math.random().toString(36).slice(2, 7)}-`
let seq = 0
const useCounterId = (): string => {
  const [id] = React.useState(() => `${prefix}${++seq}`)
  return id
}

export const useStableId: () => string = typeof nativeUseId === 'function' ? nativeUseId : useCounterId
