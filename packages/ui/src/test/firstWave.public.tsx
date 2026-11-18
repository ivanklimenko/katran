import { createRef } from 'react'
import { Icon, IconButton, Spinner, type IconName, type IconProps, type SpinnerProps } from '../index'

const icon: IconName = 'edit'
const iconProps: IconProps = { name: icon, label: 'Редактировать', size: 's' }
const spinnerProps: SpinnerProps = { label: 'Подождите', block: true, size: 'l' }

export const supported = (
  <>
    <Icon {...iconProps} />
    <IconButton name={icon} label="Правка" ref={createRef<HTMLButtonElement>()} />
    <IconButton name="submit-action" label="Отправить" type="submit"><span>Знак</span></IconButton>
    <IconButton name="submit-action" label="Отправить" children={null} />
    <IconButton name="submit-action" label="Отправить" children={undefined} />
    <Spinner {...spinnerProps} />
  </>
)

// @ts-expect-error Неизвестного SVG нет в каталоге.
export const unknownIcon = <Icon name="unknown" />
// @ts-expect-error Без children name должен быть из IconName.
export const unknownNamedButton = <IconButton label="Правка" name="custom-form-name" />
// @ts-expect-error У Spinner три поддерживаемых размера.
export const unknownSpinnerSize = <Spinner size="xl" />
