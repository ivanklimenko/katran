import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { DrawerStack } from '@katran/ui'
import { ApiError, type NotifMessage, type ResendQuery } from '../../../shared/api'
import type { NotifView } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { COPIED_TEXT, COPY_FAILED, RESEND_TEXT, createDocNotif } from '../model/createDocNotif'
import { NotifOverlay, RESEND_PROMPT } from './NotifOverlay'
import { useNotifOf } from './useNotifOf'

type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

/** Отложенный порт: вызовы копятся в calls, ответ отпускается вручную. */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}
const problem = (status: number, title: string, detail: string) =>
  new ApiError(status, { type: 'urn:katran:x', title, status, detail }, `${title}: ${detail}`)

const JSON_BODY = '{"uetr":"eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10","status":"ACCP"}'

// UI-тесты apps/pi идут на глобальном scope: модель — новая в каждом тесте
function setup() {
  const resends = deferred<ResendQuery, unknown>()
  const messages = deferred<{ id: string; nid: string }, NotifMessage>()
  const lifecycle = createPageLifecycle()
  const model = createDocNotif({ ports: { resendFx: resends.fx, messageFx: messages.fx }, lifecycle })
  const views: Record<string, NotifView> = {}
  const drawerKeys = vi.fn<(key: string) => void>()
  /** Как drawer деталки с вкладкой «Нотификации»: заголовок, кнопки вкладки; слой окна страницы — поверх. */
  function Harness() {
    const of = useNotifOf(model)
    views.d1 = of('d1')
    views.d2 = of('d2')
    const v = views.d1
    // keydown — как у DrawerStack (обработчик React над drawer): Esc окна сюда доходить не должен, иначе закрылась бы деталь
    return (
      <div role="presentation" onKeyDown={(e) => drawerKeys(e.key)}>
        <div role="dialog" aria-label="Деталь" data-k-drawer="">
          <h2 tabIndex={-1}>Платёжная инструкция</h2>
          {/* уровень заголовка окна кита — h4: в стенде порядок заголовков держит drawer, здесь — раздел вкладки */}
          <h3>Нотификации</h3>
          <button type="button" aria-disabled={v.resendBusy || undefined} onClick={() => v.resend()}>Переотправить все</button>
          <button type="button" onClick={() => v.resend('n2', 2)}>Переотправить, отправка 2</button>
          <button type="button" onClick={() => v.openMessage('n2', 2)}>Исходное сообщение, отправка 2</button>
          <div data-part="overlay" style={{ position: 'relative' }}><NotifOverlay model={model} /></div>
        </div>
      </div>
    )
  }
  const r = renderK(<Harness />)
  act(() => { lifecycle.pageOpened() })
  return { model, views, lifecycle, resends, messages, drawerKeys, ...r }
}
type T = ReturnType<typeof setup>

const live = () => screen.getAllByRole('status').find((el) => el.getAttribute('aria-live') === 'polite') as HTMLElement

/** Открыть окно строки 2 и отпустить ответ. */
async function openReady(t: T, message: NotifMessage) {
  await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
  await act(async () => { t.messages.calls[0]!.ok(message) })
  return screen.getByRole('dialog', { name: 'Исходное сообщение · отправка 2' })
}

describe('useNotifOf (спека 2e §3.3)', () => {
  it('resend без nid — Prompt «все» документа; с nid и n — одна; openMessage — окно документа', () => {
    const t = setup()
    act(() => { t.views.d1!.resend() })
    expect(t.model.$resendPrompt.getState()).toEqual({ docId: 'd1', nid: null, n: null })
    act(() => { t.model.resendResult({ docId: 'd1', ok: false }) })
    act(() => { t.views.d2!.resend('n2', 2) })
    expect(t.model.$resendPrompt.getState()).toEqual({ docId: 'd2', nid: 'n2', n: 2 })
    act(() => { t.model.resendResult({ docId: 'd2', ok: false }) })
    act(() => { t.views.d1!.openMessage('n3', 3) })
    expect(t.model.$message.getState()).toMatchObject({ docId: 'd1', nid: 'n3', n: 3, state: 'loading' })
  })

  it('resendBusy — только у документа в полёте', async () => {
    const t = setup()
    act(() => { t.views.d1!.resend() })
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    expect(t.views.d1!.resendBusy).toBe(true)
    expect(t.views.d2!.resendBusy).toBe(false)
    await act(async () => { t.resends.calls[0]!.ok([]) })
    expect(t.views.d1!.resendBusy).toBe(false)
  })
})

describe('NotifOverlay: Prompt переотправки (спека 2e §4 п. 10)', () => {
  it('все — «Переотправить все нотификации?», пояснение, «Переотправить»/«Отмена»; ok — запрос без nid, в полёте кнопки недоступны', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    const prompt = screen.getByRole('alertdialog', { name: RESEND_PROMPT.all })
    expect(RESEND_PROMPT.all).toBe('Переотправить все нотификации?')
    expect(prompt).toHaveAccessibleDescription('Будет создана новая попытка отправки')
    expect(within(prompt).getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
    await userEvent.click(within(prompt).getByRole('button', { name: 'Переотправить' }))
    expect(t.resends.calls.map((c) => c.params)).toEqual([{ id: 'd1' }])
    expect(prompt).toHaveAttribute('aria-busy', 'true')
    expect(within(prompt).getByRole('button', { name: 'Переотправить' })).toBeDisabled()
    expect(within(prompt).getByRole('button', { name: 'Отмена' })).toBeDisabled()
  })

  it('одна (n: 2) — «Переотправить нотификацию № 2?»; запрос с nid строки', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить, отправка 2' }))
    expect(RESEND_PROMPT.one(2)).toBe('Переотправить нотификацию № 2?')
    const prompt = screen.getByRole('alertdialog', { name: 'Переотправить нотификацию № 2?' })
    await userEvent.click(within(prompt).getByRole('button', { name: 'Переотправить' }))
    expect(t.resends.calls.map((c) => c.params)).toEqual([{ id: 'd1', nid: 'n2' }])
  })

  it('успех — Prompt закрыт, объявление «Нотификация переотправлена», фокус — на нажатую кнопку', async () => {
    const t = setup()
    const button = screen.getByRole('button', { name: 'Переотправить все' })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    await act(async () => { t.resends.calls[0]!.ok([]) })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(live()).toHaveTextContent(RESEND_TEXT))
    expect(button).toHaveFocus()
  })

  it('отказ — Prompt закрыт, объявление текста ошибки', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    await act(async () => { t.resends.calls[0]!.fail(problem(500, 'Ошибка', 'Шлюз недоступен')) })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(live()).toHaveTextContent('Шлюз недоступен'))
  })

  it('«Отмена» — запроса нет, Prompt закрыт; Esc в Prompt — закрыт, keydown до drawer не дошёл', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(t.drawerKeys).not.toHaveBeenCalledWith('Escape')
    expect(t.resends.calls).toHaveLength(0)
  })

  it('$notice на монтировании не объявляется (не сбрасывается с уходом с экрана)', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    await act(async () => { t.resends.calls[0]!.ok([]) })
    await waitFor(() => expect(live()).toHaveTextContent(RESEND_TEXT))
    t.unmount()
    // новый экран с той же моделью: count уже > 0 — объявления нет
    renderK(<div style={{ position: 'relative' }}><NotifOverlay model={t.model} /></div>)
    expect(live()).toHaveTextContent('')
  })

  it('без нарушений axe', async () => {
    const { container } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить, отправка 2' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('NotifOverlay: окно «Исходное сообщение» (спека 2e §3.3, §4 п. 11)', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })
  const clipboard = (writeText: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  }

  it('загрузка — заголовок «Исходное сообщение · отправка 2», скелетон (aria-busy), «Скопировать» недоступна', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    const dialog = screen.getByRole('dialog', { name: 'Исходное сообщение · отправка 2' })
    expect(within(dialog).getByText('Загрузка').closest('[aria-busy="true"]')).not.toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Скопировать' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
  })

  it.each([
    ['application/json', 'json'],
    ['application/xml', 'xml'],
    ['text/plain', 'text'],
  ] as const)('%s — CodeView language="%s"', async (contentType, language) => {
    const t = setup()
    const dialog = await openReady(t, { contentType, body: contentType === 'application/xml' ? '<a><b>1</b></a>' : 'тело сообщения' })
    const region = within(dialog).getByRole('region', { name: 'Тело сообщения' })
    expect(region).toHaveAttribute('data-lang', language)
  })

  it('тело — текстом через CodeView, разметка не исполняется', async () => {
    const t = setup()
    const dialog = await openReady(t, { contentType: 'text/plain', body: '<img src=x onerror="alert(1)">' })
    expect(dialog.querySelector('img')).toBeNull()
    expect(within(dialog).getByRole('region', { name: 'Тело сообщения' })).toHaveTextContent('<img src=x onerror="alert(1)">')
  })

  it('«Скопировать» — navigator.clipboard.writeText(body), объявление «Скопировано»', async () => {
    const t = setup()
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    const dialog = await openReady(t, { contentType: 'application/json', body: JSON_BODY })
    clipboard(writeText)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скопировать' }))
    expect(writeText).toHaveBeenCalledWith(JSON_BODY)
    await waitFor(() => expect(live()).toHaveTextContent(COPIED_TEXT))
    expect(COPIED_TEXT).toBe('Скопировано')
  })

  it('буфер отказал — «Не удалось скопировать — выделите текст»; нет Clipboard API — то же', async () => {
    const t = setup()
    const dialog = await openReady(t, { contentType: 'application/json', body: JSON_BODY })
    clipboard(() => Promise.reject(new Error('denied')))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скопировать' }))
    await waitFor(() => expect(live()).toHaveTextContent(COPY_FAILED))
    expect(COPY_FAILED).toBe('Не удалось скопировать — выделите текст')
    Reflect.deleteProperty(navigator, 'clipboard')
    const before = t.model.$notice.getState().count
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скопировать' }))
    await waitFor(() => expect(t.model.$notice.getState()).toEqual({ count: before + 1, text: COPY_FAILED }))
  })

  it('«Закрыть» — closeMessage, фокус на ссылку строки', async () => {
    const t = setup()
    const link = screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' })
    const dialog = await openReady(t, { contentType: 'application/json', body: JSON_BODY })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog', { name: /Исходное сообщение/ })).toBeNull()
    expect(t.model.$message.getState()).toBeNull()
    expect(link).toHaveFocus()
  })

  it('Esc — окно закрыто, деталь нет: keydown до drawer не дошёл, фокус на ссылку строки (Review Focus 5)', async () => {
    const t = setup()
    const link = screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' })
    await openReady(t, { contentType: 'application/json', body: JSON_BODY })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Исходное сообщение/ })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Деталь' })).toBeInTheDocument()
    expect(t.drawerKeys).not.toHaveBeenCalledWith('Escape')
    expect(link).toHaveFocus()
    // слушатель живой: следующий Esc — уже деталке
    await userEvent.keyboard('{Escape}')
    expect(t.drawerKeys).toHaveBeenCalledWith('Escape')
  })

  it('Esc во время загрузки — тоже закрывает', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    await userEvent.keyboard('{Escape}')
    expect(t.model.$message.getState()).toBeNull()
  })

  it('ошибка — текст (role="alert") и «Повторить» → повторный запрос, фокус остаётся в окне', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    await act(async () => { t.messages.calls[0]!.fail(problem(500, 'Ошибка', 'Сообщение не найдено')) })
    const dialog = screen.getByRole('dialog', { name: 'Исходное сообщение · отправка 2' })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Сообщение не найдено')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Повторить' }))
    expect(t.messages.calls).toHaveLength(2)
    expect(t.messages.calls[1]!.params).toEqual({ id: 'd1', nid: 'n2' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('без нарушений axe (загрузка, готово, ошибка)', async () => {
    const t = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    expect(await axe(t.container)).toHaveNoViolations()
    await act(async () => { t.messages.calls[0]!.ok({ contentType: 'application/xml', body: '<a><b>1</b></a>' }) })
    expect(await axe(t.container)).toHaveNoViolations()
    act(() => { t.model.closeMessage() })
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    await act(async () => { t.messages.calls[1]!.fail(problem(500, 'Ошибка', 'Сообщение не найдено')) })
    expect(await axe(t.container)).toHaveNoViolations()
  })
})

describe('NotifOverlay на странице: слой поверх настоящего DrawerStack (спека 2e §3.6, ручная проверка Task 12)', () => {
  /** Как страница реестра: деталь — в DrawerStack кита (портал в корень провайдера, z-index слоя деталки), NotifOverlay — в разметке страницы. */
  function page() {
    const resends = deferred<ResendQuery, unknown>()
    const messages = deferred<{ id: string; nid: string }, NotifMessage>()
    const lifecycle = createPageLifecycle()
    const model = createDocNotif({ ports: { resendFx: resends.fx, messageFx: messages.fx }, lifecycle })
    const onEscape = vi.fn()
    function Page() {
      const v = useNotifOf(model)('d1')
      // pointer-events: auto — как у панели Drawer кита: слой DrawerStack пропускает клики мимо панелей (pointer-events: none),
      // и правило слоя (styled-components) jsdom видит — без этого user-event не кликнул бы кнопки детали
      const node = (
        <section role="dialog" aria-label="Деталь" data-k-drawer="" style={{ pointerEvents: 'auto' }}>
          <h2 tabIndex={-1}>Платёжная инструкция</h2>
          <button type="button" onClick={() => v.resend()}>Переотправить все</button>
          <button type="button" onClick={() => v.openMessage('n2', 2)}>Исходное сообщение, отправка 2</button>
        </section>
      )
      return (
        <div data-testid="page">
          <DrawerStack items={[{ key: 'd1', slot: 'a', node }]} onEscape={onEscape} />
          <NotifOverlay model={model} />
        </div>
      )
    }
    renderK(<Page />)
    act(() => { lifecycle.pageOpened() })
    return { model, messages, onEscape }
  }

  it('окно и Prompt — не в разметке страницы под деталью, а в своём слое в корне провайдера, как DrawerStack', async () => {
    const t = page()
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    await act(async () => { t.messages.calls[0]!.ok({ contentType: 'text/plain', body: 'MT199' }) })
    const win = screen.getByRole('dialog', { name: 'Исходное сообщение · отправка 2' })
    const root = document.querySelector('[data-k-root]')
    expect(screen.getByTestId('page').contains(win)).toBe(false)
    const layer = win.closest('[data-k-layer="notif"]')
    expect(layer?.parentElement).toBe(root)
    act(() => { t.model.closeMessage() })
    // пустой слой не рисуется: клики мимо окна проходят в реестр и деталь
    expect(document.querySelector('[data-k-layer="notif"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    const prompt = screen.getByRole('alertdialog', { name: RESEND_PROMPT.all })
    expect(prompt.closest('[data-k-layer="notif"]')?.parentElement).toBe(root)
  })

  it('Esc в окне «Исходное сообщение» закрывает только окно: деталь открыта, фокус на ссылке; следующий Esc — детали', async () => {
    const t = page()
    const link = screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' })
    await userEvent.click(link)
    await act(async () => { t.messages.calls[0]!.ok({ contentType: 'text/plain', body: 'MT199' }) })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Исходное сообщение/ })).toBeNull()
    expect(t.onEscape).not.toHaveBeenCalled()
    expect(link).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(t.onEscape).toHaveBeenCalledTimes(1)
  })

  it('Esc в Prompt переотправки закрывает только Prompt', async () => {
    const t = page()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(t.onEscape).not.toHaveBeenCalled()
  })
})
