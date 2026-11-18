import { createRef } from 'react'
import { Icon, IconButton, Spinner, Text, type IconName, type IconProps, type SpinnerProps, type TextProps, type TextVariant, type TextWeight } from '../index'

const icon: IconName = 'edit'
const iconProps: IconProps = { name: icon, label: 'Редактировать', size: 's' }
const spinnerProps: SpinnerProps = { label: 'Подождите', block: true, size: 'l' }

const variant: TextVariant = 'caption'
const weight: TextWeight = 'bold'
const textProps: TextProps = { variant, weight, tone: 'muted', as: 'div', children: 'Готово' }

export const supported = (
  <>
    <Icon {...iconProps} />
    <IconButton name={icon} label="Правка" ref={createRef<HTMLButtonElement>()} />
    <IconButton name="submit-action" label="Отправить" type="submit"><span>Знак</span></IconButton>
    <IconButton name="submit-action" label="Отправить" children={null} />
    <IconButton name="submit-action" label="Отправить" children={undefined} />
    <Spinner {...spinnerProps} />
    <Text {...textProps} />
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
