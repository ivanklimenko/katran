import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, copyText } from '@katran/ui'
import { ScrollList } from './styles'

export function ManualDeviationsDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function copy() {
    setPending(true)
    const copied = await copyText(ids.join('\n'))
    if (!mounted.current) return
    setMessage(copied ? `Скопировано UUID: ${ids.length}` : 'Не удалось скопировать UUID. Выделите список и скопируйте вручную.')
    setPending(false)
  }

  return (
    <Dialog open title="Переход к ручным отклонениям" onClose={onClose}
      footer={<>
        <Button disabled={pending} onClick={() => { void copy() }}>Скопировать UUID</Button>
        <Button variant="primary" onClick={onClose}>ОК</Button>
      </>}
    >
      <p>При подключении раздела откроется список открытых ручных отклонений по UUID выделенных платёжных инструкций.</p>
      <p>Выделено платёжных инструкций: {ids.length}</p>
      <ScrollList aria-label="UUID выделенных платёжных инструкций">{ids.map((id) => <li key={id}>{id}</li>)}</ScrollList>
      <span role="status">{message}</span>
    </Dialog>
  )
}
