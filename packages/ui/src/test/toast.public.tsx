import { useToast, type ToastApi, type ToastInput, type ToastTone } from '../index'

const tone: ToastTone = 'warn'
const input: ToastInput = { tone, text: 'Требуется проверка', duration: 0 }
export function ToastButton() {
  const toast: ToastApi = useToast()
  const dismiss = () => toast.close(toast.show(input))
  return <button type="button" onClick={dismiss}>Закрыть</button>
}

// @ts-expect-error Тон должен совпадать с одним из тонов Banner.
export const unknownTone: ToastInput = { tone: 'success', text: 'Сообщение' }
