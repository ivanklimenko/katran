import { css } from '../styled'
import { k } from '@katran/tokens'

/**
 * Правила компонентов значений — горячий путь грида (спека styled §4.3, правило 2): элементы значений обычные,
 * с постоянными классами k-<часть>; правила объявлены здесь один раз, их вставляет шаблон корня провайдера
 * (provider/Root.tsx) под `*:where(&)` — префикс специфичности не добавляет.
 *
 * Перенос бывшего Value.module.css один к одному: порядок правил и специфичность прежние. Модификаторы-классы
 * стали атрибутами в `:where()` — специфичность (0,1,0), как у прежнего второго класса:
 *   CopyValue — тон `data-tone` (val, ink, ink2, muted, mono), второй кегль `data-size="s"`, вспышка `data-flash`;
 *   LinkValue — вспышка `data-flash`, без значения — `:disabled` (был класс off);
 *   StatusDot — размер `data-size` (s, m, l).
 * Вспышка (была .flash, (0,1,0) / с :hover (0,2,0) / с :hover:not(:disabled) (0,3,0)) — те же три ступени.
 *
 * no-descending-specificity в этом шаблоне выключен: правило сравнивает селекторы с общим .k-copy/.k-link
 * (например .k-copy:focus-visible и .k-copy:where([data-flash])), а порядок здесь — порядок исходного CSS,
 * где модификаторы были отдельными классами и правило их не связывало. Переставить — изменить каскад.
 */
export const valueHot = css`
  /* stylelint-disable no-descending-specificity -- порядок исходного Value.module.css, см. описание выше */
  .k-copy,
  .k-link {
    display: inline-block;
    max-width: 100%;
    padding: 0 ${k.sp1};
    margin: 0 calc(-1 * ${k.sp1});
    border: 0;
    border-radius: ${k.rS};
    background: none;
    font: inherit;
    line-height: inherit;
    text-align: left;
    cursor: copy;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    transition: background ${k.tFast};
  }

  .k-link {
    font: 500 ${k.fs2} / ${k.lh2} ${k.sans};
    color: ${k.val};
    letter-spacing: -0.01em;
  }

  .k-copy:focus-visible,
  .k-link:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 0;
  }

  .k-copy:hover,
  .k-link:hover:not(:disabled) {
    background: ${k.valSoft};
  }

  .k-copy:where([data-flash]),
  .k-link:where([data-flash]),
  .k-copy:where([data-flash]):hover,
  .k-link:where([data-flash]):hover,
  .k-copy:where([data-flash]):hover:not(:disabled),
  .k-link:where([data-flash]):hover:not(:disabled) {
    background: ${k.okSoft};
    color: ${k.ok};
  }

  .k-copy:where([data-tone='val']) {
    color: ${k.val};
  }

  .k-copy:where([data-tone='ink']) {
    color: ${k.ink};
  }

  .k-copy:where([data-tone='ink2']) {
    color: ${k.ink2};
  }

  .k-copy:where([data-size='s']) {
    font-size: ${k.fs2};
    line-height: ${k.lh2};
  }

  .k-copy:where([data-tone='muted']) {
    color: ${k.muted};
  }

  .k-copy:where([data-tone='mono']) {
    color: ${k.val};
    font-family: ${k.mono};
    font-size: ${k.fs2};
  }

  .k-ccy {
    font-weight: 600;
  }

  .k-link:where(:disabled) {
    color: ${k.faint};
    cursor: default;
    text-decoration: line-through;
    text-decoration-color: ${k.line};
  }

  .k-ftag {
    color: ${k.opt};
    font: 600 ${k.fs3} / 1 ${k.mono};
    cursor: help;
  }

  .k-dot {
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    color: ${k.paper};
    font: 700 ${k.fs3} / 1 ${k.sans};
  }

  .k-dot:where([data-size='s']) {
    width: ${k.dotS};
    height: ${k.dotS};
  }

  .k-dot:where([data-size='m']) {
    width: ${k.dotM};
    height: ${k.dotM};
  }

  .k-dot:where([data-size='l']) {
    width: ${k.dotL};
    height: ${k.dotL};
  }

  .k-dot[data-st='flow'] {
    background: ${k.stFlow};
  }

  .k-dot[data-st='flowl'] {
    background: ${k.stFlowl};
  }

  .k-dot[data-st='flowd'] {
    background: ${k.stFlowd};
  }

  .k-dot[data-st='bad'] {
    background: ${k.stBad};
  }

  .k-dot[data-st='badd'] {
    background: ${k.stBadd};
  }

  .k-dot[data-st='warn'] {
    background: ${k.stWarn};
  }

  .k-dot[data-st='ok'] {
    background: ${k.stOk};
  }

  .k-dot[data-st='okl'] {
    background: ${k.stOkl};
  }

  .k-dot[data-st='grey'] {
    background: ${k.stGrey};
  }

  /* на светлых тонах буква тёмная: paper на них в светлой теме даёт 3.0–3.2 (правило контраста st-letter-soft ≥ 4.5) */
  .k-dot[data-st='flowl'],
  .k-dot[data-st='okl'],
  .k-dot[data-st='grey'] {
    color: ${k.stLetterSoft};
  }

  .k-tag {
    display: inline-block;
    padding: 0 ${k.sp1};
    border: 1px solid ${k.line};
    border-radius: ${k.rS};
    font: 500 ${k.fs3} / ${k.lh3} ${k.sans};
    color: ${k.ink2};
    white-space: nowrap;
  }

  .k-tag[data-tone='opt'] {
    color: ${k.opt};
    border-color: ${k.optSoft};
    background: ${k.optSoft};
  }

  .k-tag[data-tone='mt'] {
    font: 600 ${k.fs2} / ${k.lh2} ${k.mono};
    color: ${k.ink2};
    border-color: ${k.line};
    background: ${k.paper};
  }

  /* warn/ok текстом ink2 (не warn/ok): на -soft подложке warn/ok дают 4.26/4.17 — ниже порога
     читаемого текста 4.5 (правило контраста в contrast.rules.ts); ink2 на тех же подложках — 8.87/8.73 */
  .k-tag[data-tone='warn'] {
    color: ${k.ink2};
    border-color: ${k.warnSoft};
    background: ${k.warnSoft};
  }

  .k-tag[data-tone='ok'] {
    color: ${k.ink2};
    border-color: ${k.okSoft};
    background: ${k.okSoft};
  }

  .k-counter {
    display: inline-grid;
    place-items: center;
    min-width: ${k.counter};
    height: ${k.counter};
    padding: 0 ${k.sp1};
    border-radius: ${k.counter};
    background: ${k.chip};
    color: ${k.ink2};
    font: 600 ${k.fs2} / 1 ${k.sans};
  }

  .k-counter[data-active] {
    background: ${k.val};
    color: ${k.paper};
  }

  .k-counter[data-zero] {
    background: none;
    color: ${k.faint};
    border: 1px solid ${k.line2};
  }

  /* на primary-кнопке (фон val): paper по рамке и тексту, и в нуле тоже — после [data-zero] при равной
     специфичности, переопределяет его (контраст paper/val — правило «текст на primary-кнопке») */
  .k-counter[data-tone='accent'] {
    background: none;
    color: ${k.paper};
    border: 1px solid ${k.paper};
  }

  .k-field {
    display: block;
    max-width: 100%;
  }

  .k-opt {
    margin-right: ${k.sp1};
    font: 700 ${k.fs1} / 1 ${k.mono};
    color: ${k.opt};
  }

  .k-field-main {
    font: ${k.fs1} / ${k.lh1} ${k.mono};
  }

  /* Двойной класс (0,2,0): подпись лежит на CopyValue (.k-copy — font: inherit, 0,1,0) — без него
     прописные и кегль зависели бы от порядка правил (финал 5b, M1). */
  .k-caption.k-caption {
    font: ${k.fs3} / ${k.lh3} ${k.sans};
    text-transform: uppercase;
  }

  .k-none {
    color: ${k.faint};
  }

  /* метка времени события (эталон .tt .tm, index.html:305–306): моно 11.5, дата ink2, время ink, доли секунды faint */
  .k-tm {
    font: ${k.fsPre} / ${k.lh1} ${k.mono};
    color: ${k.ink2};
    white-space: nowrap;
  }

  .k-tm-time {
    font-weight: 500;
    color: ${k.ink};
  }

  .k-tm-ms {
    color: ${k.faint};
  }

  /* бейдж статуса (эталон .st, index.html:105–107): 600 10.5 / 14 + 2 × 2 — высота 18, как замер эталона; пилюля, точка 6;
     текст ink2 на всех тонах — ok/warn на своих -soft ниже 4.5 (правило контраста; класс C в detail-drift) */
  .k-badge {
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    gap: ${k.badgeGap};
    padding: ${k.badgePy} ${k.badgePx};
    border-radius: ${k.rBadge};
    font: 600 ${k.fs3} / ${k.lh2} ${k.sans};
    letter-spacing: 0.02em;
    color: ${k.ink2};
    white-space: nowrap;
    vertical-align: middle;
  }

  .k-badge-dot {
    flex: none;
    width: ${k.badgeDot};
    height: ${k.badgeDot};
    border-radius: 50%;
  }

  .k-badge[data-badge='ok'] {
    background: ${k.okSoft};
  }

  .k-badge[data-badge='ok'] .k-badge-dot {
    background: ${k.stOk};
  }

  .k-badge[data-badge='bad'] {
    background: ${k.badSoft};
  }

  .k-badge[data-badge='bad'] .k-badge-dot {
    background: ${k.stBad};
  }

  .k-badge[data-badge='wait'] {
    background: ${k.warnSoft};
  }

  .k-badge[data-badge='wait'] .k-badge-dot {
    background: ${k.stWarn};
  }

  .k-badge[data-badge='neutral'] {
    background: ${k.chip};
  }

  .k-badge[data-badge='neutral'] .k-badge-dot {
    background: ${k.stGrey};
  }

  /* маркер «изменено» (эталон .hero .vd .mark, index.html:149–153): точка 6 цвета warn, под ней с зазором 1 галочка 700 8 / 8;
     у ожидающей правки галочка держит место невидимой, у утверждённой — видима, цвет ok; отступ от значения 5 */
  .k-mark {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: ${k.kvsGap};
    margin-left: ${k.badgeGap};
    vertical-align: middle;
    cursor: help;
  }

  .k-mark-dot {
    display: block;
    width: ${k.markDot};
    height: ${k.markDot};
    border-radius: 50%;
    background: ${k.warn};
  }

  .k-mark-ok {
    display: block;
    font: 700 ${k.fsMark} / ${k.fsMark} ${k.sans};
    color: ${k.faint};
    visibility: hidden;
  }

  /* отклонённая правка (спека 2d §2.1): точка цвета bad, галочка держит место невидимой */
  .k-mark[data-status='rejected'] .k-mark-dot {
    background: ${k.bad};
  }

  .k-mark[data-status='confirmed'] .k-mark-ok {
    visibility: visible;
    color: ${k.ok};
  }
`
