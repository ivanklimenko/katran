// Макет хоста (канальное метаприложение). Моделирует факты о целевой среде:
// - webpack 5 + классический webpack.container.ModuleFederationPlugin (не MF 2.0);
// - React 17.0.2 / react-dom 17.0.2 и effector — shared singleton хоста;
// - babel-loader только для своего кода, таргет ES5; node_modules не транспилируются.
// Переключатели (переменные окружения):
//   REMOTE_URL      — адрес remoteEntry.js (по умолчанию dev-сервер remote на 5211);
//   HOST_EFFECTOR=old — хост шарит effector 23.2.3 вместо 23.4.4 (проверка strictVersion у remote);
//   HOST_SHARE_JSX=1  — хост собран с automatic JSX runtime и шарит react/jsx-runtime.
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { ModuleFederationPlugin } = require('webpack').container

const REMOTE_URL = process.env.REMOTE_URL || 'http://localhost:5211/remoteEntry.js'
const oldEffector = process.env.HOST_EFFECTOR === 'old'

const shared = {
  react: { singleton: true, requiredVersion: '17.0.2', eager: false },
  'react-dom': { singleton: true, requiredVersion: '17.0.2' },
  // Хост шарит свой effector. В режиме old под ключом effector отдаётся 23.2.3.
  effector: oldEffector
    ? { singleton: true, import: 'effector-old', shareKey: 'effector', version: '23.2.3', requiredVersion: false }
    : { singleton: true, requiredVersion: '23.4.4' },
}
// Webpack отдаёт в share scope только то, что хост реально импортирует: шарить jsx-runtime имеет
// смысл, только если хост сам собран с automatic runtime — поэтому переключается и babel.
const shareJsx = process.env.HOST_SHARE_JSX === '1'
if (shareJsx) shared['react/jsx-runtime'] = { singleton: true, requiredVersion: '17.0.2' }

module.exports = (_env, argv) => ({
  entry: './src/index.js',
  // ES5 — таргет собственного кода и рантайма webpack, как у команды.
  target: ['web', 'es5'],
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    // Код хоста импортирует 'effector'; в режиме old это должен быть тот же модуль, что и в share scope.
    alias: oldEffector ? { effector$: 'effector-old' } : {},
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { ie: '11' }, modules: false }],
              ['@babel/preset-react', { runtime: shareJsx ? 'automatic' : 'classic' }],
            ],
          },
        },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: { katranRemote: `katranRemote@${REMOTE_URL}` },
      shared,
    }),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
  // Оверлей и лог предупреждений сборки в консоли браузера выключены: предупреждение «async/await в
  // ES5-рантайме» относится к самому хосту (target es5 + remotes), а автопроверка считает предупреждения консоли.
  devServer: { port: 5210, hot: false, liveReload: false, historyApiFallback: true, client: { overlay: false, logging: 'error' } },
  performance: { hints: false },
})
