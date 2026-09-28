// Макет remote команды: webpack 5 + классический ModuleFederationPlugin. Экспонирует экран
// «Валютные документы» на собранном ките (@katran/ui dist, @katran/effector, @katran/tokens —
// из тарболов pnpm pack, как из реестра). Свой код — babel ES5, node_modules не транспилируются.
// Переключатели (переменные окружения):
//   REMOTE_EFFECTOR = host (по умолчанию) | shared | own
//                     host   — effector только из share scope хоста, без своей запасной копии (import: false);
//                              effector-react — своя копия (хост его не шарит), её импорт effector — хоста;
//                     shared — singleton со своей запасной копией (при равных версиях webpack выбрал копию remote
//                              для всей страницы, при более новой версии у remote — навязать её хосту);
//                     own    — не шарить: своя копия effector и effector-react в бандле remote;
//   REMOTE_EFFECTOR_DEEP=0 — не шарить 'effector/effector.mjs' (воспроизвести вторую копию effector);
//   REMOTE_JSX_SHARE = (пусто) | 1 | host — react/jsx-runtime: по умолчанию не шарится (берётся из
//                     своего React 17, внутри он зовёт React через share scope); 1 — singleton ^17.0.2
//                     со своей запасной копией; host — только копия хоста (import: false);
//   REMOTE_REACT19=1 — react/jsx-runtime remote разрешается в React 19 (моделирует React 19 в devDeps);
//   REMOTE_CSS      = style (по умолчанию) | extract — style-loader или mini-css-extract-plugin;
const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { ModuleFederationPlugin } = require('webpack').container

const EFFECTOR = process.env.REMOTE_EFFECTOR || 'host'
const JSX_SHARE = process.env.REMOTE_JSX_SHARE || ''
const REACT19 = process.env.REMOTE_REACT19 === '1'
const CSS = process.env.REMOTE_CSS || 'style'

const shared = {
  // React и react-dom — только хоста: import: false не кладёт в remote запасную копию,
  // без хоста экран не поднимется (так и должно быть — второй React недопустим).
  react: { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
  'react-dom': { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
}
// effector-react.mjs (ESM-сборка, её выбирает webpack для import) импортирует не 'effector', а
// 'effector/effector.mjs' — это другой запрос, ключ 'effector' его не ловит, и в бандл remote молча
// попадает вторая копия effector: хранилища моделей — из одной, подписки useUnit — из другой.
// Итог в макете: combine-стор $dirty модели фильтров переставал обновляться («Применить» не
// активировалась). Глубокий путь отдаётся в тот же shareKey. REMOTE_EFFECTOR_DEEP=0 — воспроизвести.
const deepEffector = process.env.REMOTE_EFFECTOR_DEEP !== '0'
if (EFFECTOR === 'host') {
  // effector — хоста (он шарит свой). effector-react хост не шарит — берём свою копию,
  // её импорт effector идёт через share scope, поэтому граф у хоста и remote один.
  shared.effector = { singleton: true, requiredVersion: '^23.4.0', strictVersion: true, import: false }
  if (deepEffector) shared['effector/effector.mjs'] = { ...shared.effector, shareKey: 'effector' }
}
if (EFFECTOR === 'shared') {
  shared.effector = { singleton: true, requiredVersion: '^23.4.0', strictVersion: true }
  if (deepEffector) shared['effector/effector.mjs'] = { ...shared.effector, shareKey: 'effector', import: false }
  shared['effector-react'] = { singleton: true, requiredVersion: '^23.3.0', strictVersion: true }
}
if (JSX_SHARE) shared['react/jsx-runtime'] = { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, ...(JSX_SHARE === 'host' ? { import: false } : {}) }

const styleLoader = CSS === 'extract' ? MiniCssExtractPlugin.loader : 'style-loader'

module.exports = (_env, argv) => ({
  entry: {},
  target: ['web', 'es5'],
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    // publicPath: 'auto' — чанки и шрифты грузятся с адреса, откуда пришёл remoteEntry.js, а не с хоста.
    publicPath: 'auto',
    uniqueName: 'katranRemote',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: REACT19 ? { 'react/jsx-runtime$': path.resolve(__dirname, 'node_modules/react19/jsx-runtime.js') } : {},
  },
  module: {
    rules: [
      // Правило fullySpecified: false для @katran/* не нужно: dist кита собран с classic JSX runtime
      // и не импортирует 'react/jsx-runtime' (у React 17 нет поля exports, в ESM-пакете webpack 5
      // не разрешал этот импорт без .js).
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { ie: '11' }, modules: false }],
              ['@babel/preset-react', { runtime: 'automatic' }],
              ['@babel/preset-typescript', { allowDeclareFields: true }],
            ],
          },
        },
      },
      {
        test: /\.module\.css$/,
        use: [styleLoader, { loader: 'css-loader', options: { modules: { localIdentName: 'docs-[local]-[hash:base64:5]', namedExport: false, exportLocalsConvention: 'as-is' } } }],
      },
      { test: /\.css$/, exclude: /\.module\.css$/, use: [styleLoader, 'css-loader'] },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'katranRemote',
      filename: 'remoteEntry.js',
      exposes: { './DocumentsScreen': './src/DocumentsScreen.tsx' },
      shared,
    }),
    ...(CSS === 'extract' ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' })] : []),
  ],
  devServer: {
    port: 5211,
    hot: false,
    liveReload: false,
    // Шрифты — cross-origin ресурс: без CORS-заголовка браузер их не применит.
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  performance: { hints: false },
})
