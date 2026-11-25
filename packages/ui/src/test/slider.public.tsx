import { Slider, type SliderProps } from '../index'

const props: SliderProps = { label: 'Объём', value: 40, min: 0, max: 100, onChange: (value) => value.toFixed(0) }
export const slider = <Slider {...props} />

// @ts-expect-error Значение шкалы должно быть числом.
export const invalidSlider = <Slider {...props} value="40" />
