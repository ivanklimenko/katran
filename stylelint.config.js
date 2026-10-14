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
  overrides: [
    {
      // Шаблоны styled-components (спека styled §6): те же правила, разбор — postcss-styled-syntax.
      // Проверяется исходный текст шаблона: интерполяции ${…} остаются как есть, вендорные префиксы,
      // которые stylis добавляет при выполнении, сюда не попадают.
      files: ['**/*.ts', '**/*.tsx'],
      customSyntax: 'postcss-styled-syntax',
      rules: {
        'selector-class-pattern': ['^([a-z][a-zA-Z0-9]*|k-[a-z0-9-]+)$', {
          message: 'Класс в шаблоне — camelCase или класс горячего пути k-<kebab-case>',
        }],
        // Интерполяцию ${…} в дескрипторе @font-face (font-weight: ${f.weight}) правило считает неизвестным
        // значением; у деклараций stylelint интерполяции пропускает сам. Планку браузера для @font-face
        // проверяет check-css-target.
        'at-rule-descriptor-value-no-unknown': null,
      },
    },
  ],
}
