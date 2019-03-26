import {isObject} from "lodash"
import RobotsTxtPlugin from "robotstxt-webpack-plugin"
import CnamePlugin from "cname-webpack-plugin"
import WebappPlugin from "webapp-webpack-plugin"
import HtmlPlugin from "html-webpack-plugin"
import ScriptExtPlugin from "script-ext-html-webpack-plugin"
import MonacoEditorPlugin from "monaco-editor-webpack-plugin"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import OptimizeCssAssetsPlugin from "optimize-css-assets-webpack-plugin"
import webpackMerge from "webpack-merge"
import webpack from "webpack"

import getPostcssConfig from "./getPostcssConfig"

export const defaultOptions = () => ({
  nodeExternals: false,
})

export const webpackConfig = ({options, pkg, fromRoot, initialWebpackConfig}) => {
  const port = process.env.webpackPort
  const srcDirectory = fromRoot("src")
  const publicPath = do {
    if (port) {
      `http://localhost:${port}/`
    } else if (!options.development && options.domain) {
      `https://${domain}/`
    } else if (options.development) {
      srcDirectory
    }
    ""
  }
  const title = options.title || pkg.title || pkg.config?.title || "App"

  const cssIdentName = options.development ? "[folder]_[local]_[hash:base62:4]" : "[hash:base64:6]"

  const internalCssLoader = {
    loader: "css-loader",
    options: {
      sourceMap: options.development,
      modules: true,
      localIdentName: cssIdentName,
    },
  }

  const externalCssLoader = {
    loader: "css-loader",
    options: {
      sourceMap: options.development,
      localIdentName: cssIdentName,
    },
  }

  const postcssLoader = {
    loader: "postcss-loader",
    options: getPostcssConfig(options),
  }

  const styleLoaders = [
    {
      test: /\.(css|scss)$/,
      use: {
        loader: (options.createCssFile && !port) ? MiniCssExtractPlugin.loader : "style-loader",
        options: {
          hmr: options.development,
          singleton: !options.development,
        },
      },
    },
    {
      test: /\.css$/,
      include: srcDirectory,
      use: [
        internalCssLoader,
        postcssLoader,
      ],
    },
    {
      test: /\.css$/,
      exclude: srcDirectory,
      use: [
        externalCssLoader,
        postcssLoader,
      ],
    },
    {
      test: /\.scss$/,
      use: [
        internalCssLoader,
        postcssLoader,
        "resolve-url-loader",
        {
          loader: "sass-loader",
          options: {
            sourceMap: true,
            sourceMapContents: false,
          },
        },
      ],
    },
  ]

  let additionalWebpackConfig = {
    target: "web",
    node: {
      fs: "empty",
    },
    output: {
      publicPath,
      filename: options.development ? "index.js" : "[chunkhash:6].js",
    },
    module: {
      rules: [
        {
          test: /\.(png|jpg|jpeg|webp|gif|svg|woff2|ttf|eot|otf|ico|mp4|flv)$/,
          use: {
            loader: "url-loader",
            options: {
              limit: 4000,
              fallback: {
                loader: "file-loader",
                options: {
                  name: options.development ? "[path][name].[ext]" : "[hash:base62:8].[ext]",
                },
              },
            },
          },
        },
        {
          test: /\.md$/,
          use: ["html-loader", "markdown-loader"],
        },
        ...styleLoaders,
      ],
    },
    plugins: [
      new HtmlPlugin({
        title,
        debug: options.development,
        alwaysWriteToDisk: true,
        minify: options.development ? false : {
          removeAttributeQuotes: true,
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          decodeEntities: true,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
          removeRedundantAttributes: true,
          sortAttributes: true,
          sortClassName: true,
          useShortDoctype: true,
        },
      }),
      new ScriptExtPlugin({
        defaultAttribute: "defer",
      }),
    ],
  }

  if (port) {
    additionalWebpackConfig = webpackMerge.smart(additionalWebpackConfig, {
      entry: [
        "react-hot-loader/patch",
        `webpack-dev-server/client?http://localhost:${port}/`,
        "webpack/hot/only-dev-server",
        initialWebpackConfig.entry,
      ],
      devServer: {
        port,
        publicPath,
        inline: true,
        lazy: false,
        hot: true,
        noInfo: true,
        overlay: true,
        stats: "errors-only",
        headers: {"Access-Control-Allow-Origin": "*"},
        contentBase: fromRoot("dist", "package", "development"),
        historyApiFallback: {
          verbose: true,
          disableDotRule: false,
        },
      },
      plugins: [new webpack.HotModuleReplacementPlugin],
      resolve: {
        alias: {
          "react-dom": "@hot-loader/react-dom",
        },
      },
    })
  }

  if (!options.development) {
    if (options.icon) {
      additionalWebpackConfig.plugins.push(new WebappPlugin({
        logo: options.icon,
        prefix: "/",
        cache: "cache/webapp-webpack-plugin",
        inject: true,
        emitStats: false,
        favicons: {
          appName: title,
          appDescription: pkg.description,
          developerName: pkg.author?.name,
          developerURL: pkg.author?.url,
          version: pkg.version,
          background: "#283c31",
          theme_color: "#adffb3",
          orientation: "portrait",
          icons: {
            appleIcon: {offset: 10},
            appleStartup: true,
            coast: {offset: 10},
            firefox: {offset: 15},
          },
        },
      }))
    }

    if (options.domain) {
      additionalWebpackConfig.plugins.push(new CnamePlugin({domain: options.domain}))
    }

    if (options.robots === true) {
      additionalWebpackConfig.plugins.push(new RobotsTxtPlugin)
    } else if (isObject(options.robots)) {
      additionalWebpackConfig.plugins.push(new RobotsTxtPlugin(options.robots))
    }

    if (options.optimizeCss) {
      const pluginOptions = isObject(options.optimizeCss) ? options.optimizeCss : {
        cssProcessorPluginOptions: {
          preset: [
            "advanced",
            {
              discardComments: {removeAll: true},
            },
          ],
        },
      }

      additionalWebpackConfig.plugins.push(new OptimizeCssAssetsPlugin(pluginOptions))
    }
  }

  if (options.includeMonacoEditor) {
    let pluginOptions
    if (Array.isArray(options.includeMonacoEditor)) {
      pluginOptions = {
        languages: options.includeMonacoEditor,
      }
    } else if (isObject(options.includeMonacoEditor)) {
      pluginOptions = options.includeMonacoEditor
    } else {
      pluginOptions = {
        languages: ["javascript", "plaintext"],
      }
    }
    additionalWebpackConfig.plugins.push(new MonacoEditorPlugin(pluginOptions))
  }

  if (options.createCssFile) {
    const pluginOptions = isObject(options.createCssFile) ? options.createCssFile : {
      filename: options.development ? "[name].css" : "[contenthash:6].css",
      chunkFilename: options.development ? "[id].css" : "[contenthash:6].css",
    }
    additionalWebpackConfig.plugins.push(new MiniCssExtractPlugin(pluginOptions))
  }

  return additionalWebpackConfig
}