import { createRef } from 'react'
import { Icon, IconButton, Link, RadioGroup, Spinner, Text, Textarea, type IconName, type IconProps, type LinkProps, type RadioGroupProps, type RadioOption, type SpinnerProps, type TextareaProps, type TextProps, type TextVariant, type TextWeight } from '../index'

const icon: IconName = 'edit'
const iconProps: IconProps = { name: icon, label: 'Редактировать', size: 's' }
const spinnerProps: SpinnerProps = { label: 'Подождите', block: true, size: 'l' }

const variant: TextVariant = 'caption'
const weight: TextWeight = 'bold'
const textProps: TextProps = { variant, weight, tone: 'muted', as: 'div', children: 'Готово' }

const linkProps: LinkProps = { href: '/doc', target: '_blank', children: 'Документ' }

const textareaProps: TextareaProps = {
  name: 'comment',
  rows: 4,
  size: 'm',
  onChange: (event) => event.currentTarget.setCustomValidity(''),
}

const radioOptions: RadioOption[] = [{ value: 'pending', label: 'На проверке' }]
const radioProps: RadioGroupProps = { name: 'status', label: 'Статус', value: null, options: radioOptions, onChange: (value) => value.toUpperCase() }

export const supported = (
  <>
    <Icon {...iconProps} />
    <IconButton name={icon} label="Правка" ref={createRef<HTMLButtonElement>()} />
    <IconButton name="submit-action" label="Отправить" type="submit"><span>Знак</span></IconButton>
    <IconButton name="submit-action" label="Отправить" children={null} />
    <IconButton name="submit-action" label="Отправить" children={undefined} />
    <Spinner {...spinnerProps} />
    <Text {...textProps} />
    <Textarea {...textareaProps} ref={createRef<HTMLTextAreaElement>()} />
    <RadioGroup {...radioProps} />
    <Link {...linkProps} ref={createRef<HTMLAnchorElement>()} />
  </>
)

// @ts-expect-error Неизвестного SVG нет в каталоге.
export const unknownIcon = <Icon name="unknown" />
// @ts-expect-error Без children name должен быть из IconName.
export const unknownNamedButton = <IconButton label="Правка" name="custom-form-name" />
// @ts-expect-error У Spinner три поддерживаемых размера.
export const unknownSpinnerSize = <Spinner size="xl" />

// @ts-expect-error Text принимает только теги из контракта.
export const unknownTextTag = <Text as="h1">Текст</Text>
// @ts-expect-error Содержимое Text обязательно.
export const missingTextChildren = <Text variant="body" />

// @ts-expect-error Содержимое Link обязательно.
export const missingLinkChildren = <Link href="/doc" />

// @ts-expect-error Размер Textarea принимает токен размера.
export const numericTextareaSize = <Textarea size={24} />

// @ts-expect-error RadioGroup требует имя нативной группы.
export const missingRadioName = <RadioGroup label="Статус" value={null} options={radioOptions} onChange={() => {}} />
