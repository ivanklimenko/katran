// prepublishOnly пакетов кита: останавливает публикацию из папки пакета клиентом, который не pnpm.
// npm и yarn публикуют манифест как есть — зависимость "workspace:*" уходит в реестр и не ставится
// у потребителя; на версию её заменяет только pnpm (pack и publish). Публиковать любым клиентом можно
// готовый тарбол: pnpm release:pack → npm publish release/<файл>.tgz (для тарбола этот сценарий не запускается).
const agent = process.env.npm_config_user_agent ?? ''
if (!agent.startsWith('pnpm/')) {
  console.error([
    '',
    'katran: публикация из папки пакета возможна только через pnpm — npm не заменяет "workspace:*" на версию.',
    'Соберите тарболы и публикуйте их любым клиентом:',
    '  pnpm release:pack',
    '  npm publish release/<пакет>.tgz',
    '',
  ].join('\n'))
  process.exit(1)
}
