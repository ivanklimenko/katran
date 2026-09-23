/** Спека 4.3: размеры только токенами. px допустим лишь там, где плотность не применяется. */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'selector-class-pattern': ['^[a-z][a-zA-Z0-9]*$', {
      message: 'Локальное имя класса CSS Modules — camelCase; префикс k- добавляет сборка',
    }],
    'unit-disallowed-list': [['px', 'rem', 'em'], {
      ignoreProperties: {
        px: ['/^border/', '/^outline/', 'box-shadow', 'letter-spacing', 'text-decoration-thickness', 'text-underline-offset'],
        em: ['letter-spacing'],
      },
      message: 'Размер должен приходить из токена var(--k-…)',
    }],
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-value-disallowed-list': { '/.*/': ['/rgba?\\(/', '/hsla?\\(/'] },
    'custom-property-pattern': '^k-[a-z0-9-]+$',
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
  },
}
