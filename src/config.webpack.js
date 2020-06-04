const path = require('path')
const webpack = require('webpack')
// const SvgStoreWebpackPlugin = require('webpack-svgstore-plugin')
const TerserJSPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const Visualizer = require('webpack-visualizer-plugin')
const yaml = require('js-yaml')
const AssetsPlugin = require('assets-webpack-plugin')
// const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const scrolex = require('scrolex').persistOpts({
  announce             : true,
  addCommandAsComponent: true,
  components           : 'lanyon>config>webpack',
})

module.exports = function ({ runtime }) {
  const jsDirs = [
    `${runtime.assetsSourceDir}`,
  ].concat((runtime.extraAssetsSourceDirs || []))

  const moduleDirs = [
    runtime.assetsSourceDir,
    path.join(runtime.projectDir, 'node_modules'),
    path.join(runtime.npmRoot, 'node_modules'),
    path.join(runtime.lanyonDir, 'node_modules'),
  ].concat(runtime.extraAssetsSourceDirs || [])

  const browsers = runtime.browsers || ['> 1%', 'ie 10', 'ie 8', 'safari 4']

  const webpackRules = () => {
    const rules = []

    rules.push({
      test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader : 'url-loader',
          options: {
            limit   : 10000,
            mimetype: 'application/font-woff',
          },
        },
      ],
    })

    rules.push({
      test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader : 'url-loader',
          options: {
            limit   : 10000,
            mimetype: 'application/font-woff',
          },
        },
      ],
    })

    rules.push({
      test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader : 'url-loader',
          options: {
            limit   : 10000,
            mimetype: 'application/octet-stream',
          },
        },
      ],
    })

    rules.push({
      test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader: 'file-loader',
        },
      ],
    })

    rules.push({
      test: /\.cur(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader: 'file-loader',
        },
      ],
    })

    rules.push({
      test: /\.worker\.js$/,
      use : [
        { loader: 'worker-loader' },
      ],
    })

    rules.push({
      test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
      use : [
        {
          loader : 'url-loader',
          options: {
            limit   : 10000,
            mimetype: 'image/svg+xml',
          },
        },
      ],
    })

    rules.push({
      test: /\.(png|gif|jpe?g)$/,
      use : [
        {
          loader : 'url-loader',
          options: {
            limit   : 8096,
            mimetype: 'application/octet-stream',
          },
        },
      ],
    })

    rules.push({
      // https://www.techchorus.net/blog/using-sass-version-of-bootstrap-with-webpack/
      test: /[\\/]bootstrap-sass[\\/]assets[\\/]javascripts[\\/]/,
      use : [
        // loader: 'imports?this=>window',
        {
          loader : 'imports-loader',
          options: {
            this: '>window',
          },
        },
      ],
    })

    rules.push({
      test: /[\\/]jquery\..*\.js$/,
      use : [
        // loader: 'imports?this=>window',
        {
          loader : 'imports-loader',
          options: {
            this: '>window',
          },
        },
      ],
    })

    rules.push({
      test: /\.(sa|sc|c)ss$/,
      use : [
        {
          loader : MiniCssExtractPlugin.loader,
          options: {
            hmr: runtime.isDev,
          },
        },
        'css-loader',
        'resolve-url-loader',
        {
          loader : 'postcss-loader',
          options: {
            sourceMap: true,
            ident    : 'postcss',
            plugins  : (loader) => [
              require('autoprefixer')({
                overrideBrowserslist: browsers,
              }),
            ],
          },
        },
        'sass-loader',
      ],
    })

    rules.push({
      test: /\.less$/,
      use : [
        {
          loader : MiniCssExtractPlugin.loader,
          options: {
            hmr: runtime.isDev,
          },
        },
        'css-loader',
        'resolve-url-loader',
        {
          loader : 'postcss-loader',
          options: {
            sourceMap: true,
            ident    : 'postcss',
            plugins  : (loader) => [
              require('autoprefixer')({
                overrideBrowserslist: browsers,
              }),
            ],
          },
        },
        'less-loader',
      ],
    })

    rules.push({
      test   : /\.(js|jsx)$/,
      include: jsDirs,
      exclude: [
        /[\\/](node_modules|js-untouched)[\\/]/,
      ],
      use: [
        {
          loader : 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              [require.resolve('@babel/preset-env'), {
                debug  : false,
                modules: 'commonjs',
                loose  : false,
              }],
              require.resolve('@babel/preset-react'),
            ],
            plugins: [
              [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
              require.resolve('@babel/plugin-proposal-class-properties'),
              require.resolve('react-hot-loader/babel'),
              require.resolve('nanohtml'),
            ],
            // sourceRoot    : `${runtime.projectDir}`,
            cacheDirectory: `${runtime.cacheDir}/babelCache`,
          },
        },
      ],
    })

    return rules
  }

  const webpackPlugins = () => {
    const plugins = []

    plugins.push(new webpack.DefinePlugin({
      'process.env.LANYON_ENV': JSON.stringify(runtime.lanyonEnv),
      'process.env.NODE_ENV'  : JSON.stringify(process.env.NODE_ENV),
      'process.env.ENDPOINT'  : JSON.stringify(process.env.ENDPOINT),
    }))
    // plugins.push(new SvgStoreWebpackPlugin({
    //   svgoOptions: {
    //     plugins: [
    //       { removeTitle: true },
    //     ],
    //   },
    //   prefix: 'icon-',
    // }))
    plugins.push(new AssetsPlugin({
      filename: 'jekyll.lanyon_assets.yml',
      path    : runtime.cacheDir,
      processOutput (assets) {
        scrolex.stick(`Writing asset manifest to: "${runtime.cacheDir}/jekyll.lanyon_assets.yml"`)
        if (!assets) {
          console.error({ assets })
          scrolex.failure(`The assets var was empty!`)
          process.exit(1)
        }
        if ('' in assets) {
          assets.orphaned = assets['']
          delete assets['']
        }

        let payload = ''
        try {
          payload = yaml.safeDump({ lanyon_assets: assets })
        } catch (e) {
          console.error({ assets })
          throw new Error(`Unable to encode above config to YAML. ${e.message}`)
        }
        return payload
      },
    }))

    plugins.push(new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename     : runtime.isDev ? `[name].css` : `[name].[contenthash].css`,
      chunkFilename: runtime.isDev ? `[name].css` : `[name].[contenthash].[id].chunk.css`,
      ignoreOrder  : true, // <-- add this to avoid: "Order in extracted chunk undefined" ¯\_(ツ)_/¯ https://github.com/redbadger/website-honestly/issues/128
    }))

    if (runtime.isDev) {
      plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    return plugins
  }

  const webpackCfg = {
    mode        : runtime.isDev ? 'development' : 'production',
    optimization: {
      minimize : !runtime.isDev,
      minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})],
    },
    entry: (function dynamicEntries () {
      var entries = {}

      runtime.entries.forEach(entry => {
        entries[entry] = [path.join(runtime.assetsSourceDir, `${entry}.js`)]

        if (entry === 'app' && runtime.isDev) {
          entries[entry].unshift('webpack-hot-middleware/client')
        }
      })

      return entries
    }()),
    node: {
      fs    : 'empty',
      module: 'empty',
    },
    target: 'web',
    output: {
      publicPath   : runtime.publicPath,
      path         : runtime.assetsBuildDir,
      filename     : runtime.isDev ? `[name].js`: `[name].[contenthash].js`,
      chunkFilename: runtime.isDev ? `[name].js`: `[name].[contenthash].[id].chunk.js`,
    },
    devtool: (function dynamicDevtool () {
      // https://webpack.js.org/configuration/devtool/#devtool
      if (runtime.isDev) {
        return 'eval-source-map'
      }

      return 'source-map'
    }()),
    // bail  : false, // <-- We use our own ReportErrors plugin as with bail errors details are lost. e.g.: `Error at NormalModule.onModuleBuildFailed`
    bail: true,
    module: {
      rules: webpackRules(),
    },
    plugins      : webpackPlugins(),
    resolveLoader: {
      modules: [
        path.join(runtime.lanyonDir, 'node_modules'),
        path.join(runtime.npmRoot, 'node_modules'),
        path.join(runtime.projectDir, 'node_modules'),
      ],
    },
    recordsPath: runtime.recordsPath,
    stats      : {
      // Examine all modules
      maxModules         : Infinity,
      // Display bailout reasons
      optimizationBailout: true,
    },
    resolve: {
      modules: moduleDirs,

      // These JSON files are read in directories
      descriptionFiles: ['package.json'],

      // These fields in the description files are looked up when trying to resolve the package directory
      mainFields: ['browser', 'main'],

      // These files are tried when trying to resolve a directory
      mainFiles: ['index'],

      // These fields in the description files offer aliasing in this package
      // The content of these fields is an object where requests to a key are mapped to the corresponding value
      aliasFields: ['browser'],

      // These extensions are tried when resolving a file
      extensions: ['.js', '.json'],

      // If false it will also try to use no extension from above
      enforceExtension: false,

      // If false it's also try to use no module extension from above
      enforceModuleExtension: false,
      // These aliasing is used when trying to resolve a module
      alias                 : runtime.alias,
    },
  }

  return webpackCfg
}
