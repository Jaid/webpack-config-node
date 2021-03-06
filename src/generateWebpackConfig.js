import fss from "@absolunet/fss"
import appRootPath from "app-root-path"
import {CleanWebpackPlugin} from "clean-webpack-plugin"
import CopyWebpackPlugin from "copy-webpack-plugin"
import ensureArray from "ensure-array"
import ensureStart from "ensure-start"
import flatted from "flatted"
import fs from "fs"
import hasContent from "has-content"
import JsdocTsdWebpackPlugin from "jsdoc-tsd-webpack-plugin"
import json5 from "json5"
import {LicenseWebpackPlugin} from "license-webpack-plugin"
import {isObject, isString} from "lodash"
import path from "path"
import PkgBannerPlugin from "pkg-banner-webpack-plugin"
import PublishimoWebpackPlugin from "publishimo-webpack-plugin"
import readPkg from "read-pkg"
import TerserPlugin from "terser-webpack-plugin"
import webpack from "webpack"

import outputYaml from "lib/outputYaml"
import renderLicenses from "lib/renderLicenses"
import webpackMerge from "lib/webpackMerge"

import types from "./types"

const debug = require("debug")(process.env.REPLACE_PKG_NAME)

const env = process.env.NODE_ENV?.toLowerCase?.() || "development"

/**
 * @param {import("./index.js").WebpackConfigJaidOptions} options
 */
export default (options = {}) => {
  debug("NODE_ENV: %s", env)

  debug("Passed options: %o", options)

  let pkg
  try {
    pkg = readPkg.sync({
      cwd: options.packageRoot || String(appRootPath),
      normalize: true,
    })
    debug("Pkg data: %o", pkg)
  } catch {
    pkg = {}
  }

  if (pkg.webpackConfigJaid) {
    debug("Found webpackConfigJaid field in pkg: %s", pkg.webpackConfigJaid)
    if (isString(pkg.webpackConfigJaid)) {
      options = {
        type: pkg.webpackConfigJaid,
        ...options,
      }
    } else {
      options = {
        ...pkg.webpackConfigJaid,
        ...options,
      }
    }
  }

  /**
   * @type {import("./types/WebpackConfigType").default}
   */
  let typeProvider
  let typeDefaultOptions
  if (options.type) {
    if (isString(options.type)) {
      const typeClass = types[options.type]
      if (!typeClass) {
        throw new TypeError(`Invalid webpack-config-jaid type "${options.type}", returned ${typeClass} (Available types: ${Object.keys(types).join(", ")})`)
      }
      typeProvider = new typeClass
    } else {
      typeProvider = options.type
    }
    typeProvider.pkg = pkg
    typeDefaultOptions = typeProvider.getDefaultOptions({
      env,
      options,
      webpack,
    })
    if (hasContent(typeDefaultOptions)) {
      debug("Including default options from %s: %o", options.type, typeDefaultOptions)
    }
  }

  options = {
    packageRoot: String(appRootPath),
    sourceFolder: "src",
    development: env !== "production",
    extra: null,
    extraProduction: null,
    extraDevelopment: null,
    type: null,
    include: [
      "readme.*",
      "license.*",
    ],
    licenseFileName: "thirdPartyLicenses.txt",
    terserOptions: {
      compress: {
        passes: 5,
      },
    },
    terserPluginOptions: {
      extractComments: false,
    },
    publishimo: false,
    documentation: false,
    nodeExternals: true,
    configOutput: Boolean(process.env.debugWebpack),
    title: pkg.title || null,
    robots: false,
    icon: null,
    domain: pkg.domain || null,
    createCssFile: true,
    optimizeCss: true,
    hashbang: null,
    backgroundColor: "000000",
    themeColor: "04AAE3",
    excludeLocale: true,
    appDescription: null,
    twitterSiteHandle: null,
    twitterAuthorHandle: null,
    locale: "en-US",
    sitemap: false,
    googleAnalyticsOnlyInProduction: true,
    offline: false,
    pwa: false,
    browserSync: process.env.browserSync,
    ...typeDefaultOptions || {},
    ...options,
  }

  const fromRoot = (...directive) => path.resolve(options.packageRoot, ...directive)

  // output.path of Webpack config must be an absolute path, forcing here
  if (options.outDir && !path.isAbsolute(options.outDir)) {
    const absoluteOutDir = fromRoot(options.outDir)
    debug("Rewriting outDir %s to %s", options.outDir, absoluteOutDir)
    options.outDir = fromRoot(options.outDir)
  }

  /**
   * @type {import("./index.js").WebpackConfigJaidOptions}
   */
  options = {
    clean: !options.development,
    banner: !options.development,
    outDir: fromRoot("dist", "package", env),
    ...options,
  }

  typeProvider.processOptions(options, {
    env,
    fromRoot,
  })

  typeProvider.options = options

  const entryFolder = options.sourceFolder ? fromRoot(options.sourceFolder) : options.packageRoot

  let entry
  const specificEntry = path.join(entryFolder, `index.${env}.js`)
  if (fs.existsSync(specificEntry)) {
    entry = specificEntry
    debug("Using environment-specific entry %s", specificEntry)
  } else {
    const defaultEntry = entryFolder
    entry = defaultEntry
    debug("Could not find entry %s, using %s instead", specificEntry, defaultEntry)
  }

  /**
   * @type {import("webpack").Configuration}
   */
  const config = {
    entry,
    context: path.resolve(options.packageRoot),
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".yml"],
    },
    mode: options.development ? "development" : "production",
    devtool: options.development ? "eval-source-map" : "source-map",
    optimization: {},
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          oneOf: [
            {
              resourceQuery: /\?aot$/,
              use: [
                "aot-loader",
                "babel-loader",
              ],
            },
            {
              include: entryFolder,
              loader: "babel-loader",
            },
          ],
        },
        {
          test: /\.(yaml|yml)$/,
          loader: "yml-loader",
        },
        {
          test: /\.lines$/,
          loader: "lines-loader",
        },
        {
          test: /\.rlines$/,
          loader: "lines-loader",
          options: {
            sort: true,
            random: true,
          },
        },
        {
          test: /\.txt$/,
          loader: "raw-loader",
        },
        {
          test: /\.(hbs|handlebars)$/,
          oneOf: [
            {
              resourceQuery: /\?html/,
              loader: "handlebars-loader",
            },
            {
              loader: "handlebars-loader",
              options: {
                precompileOptions: {
                  noEscape: true,
                },
              },
            },
          ]
          ,
        },
      ],
    },
    plugins: [
      new webpack.LoaderOptionsPlugin({
        debug: options.development,
        minimize: !options.development,
      }),
    ],
    output: {
      path: options.outDir,
      filename: "index.js",
    },
    stats: {
      all: false,
      assets: true,
      assetsSort: "!size",
      excludeAssets: /.(map|d.ts)$/,
      colors: true,
      warnings: true,
      errors: true,
      errorDetails: true,
    },
    performance: {
      maxEntrypointSize: 4 * 1000 * 1000, // 4 MB
      maxAssetSize: 4 * 1000 * 1000, // 4 MB
    },
  }

  if (options.clean) {
    if (isObject(options.clean)) {
      config.plugins.push(new CleanWebpackPlugin(options.clean))
    } else if (Array.isArray(options.clean)) {
      config.plugins.push(new CleanWebpackPlugin({
        verbose: false,
        cleanOnceBeforeBuildPatterns: options.clean,
      }))
    } else if (options.clean === true) {
      config.plugins.push(new CleanWebpackPlugin({
        verbose: false,
        cleanOnceBeforeBuildPatterns: [options.outDir],
      }))
    }
  }

  if (options.development) {
    Object.assign(config.output, {
      auxiliaryComment: {
        root: "[Exposing Section] root",
        commonjs: "[Exposing Section] commonjs",
        commonjs2: "[Exposing Section] commonjs2",
        amd: "[Exposing Section] amd",
      },
    })
  }

  if (options.nodeExternals) {
    config.externals = ({request}, callback) => { // eslint-disable-line promise/prefer-await-to-callbacks
      if (pkg.dependencies?.[request] || pkg.peerDependencies?.[request]) {
        return callback(null, `commonjs2 ${request}`) // eslint-disable-line promise/prefer-await-to-callbacks
      }
      callback() // eslint-disable-line promise/prefer-await-to-callbacks
    }
  }

  if (options.documentation) {
    const plugin = options.documentation === true ? new JsdocTsdWebpackPlugin : new JsdocTsdWebpackPlugin(options.documentation)
    config.plugins.push(plugin)
    if (options.clean) {
      const htmlJsdocPath = path.join(path.dirname(options.outDir), "homepage")
      const tsdJsdocPath = path.join(path.dirname(options.outDir), "tsd")
      config.plugins.push(new CleanWebpackPlugin({
        verbose: false,
        cleanOnceBeforeBuildPatterns: [htmlJsdocPath, tsdJsdocPath],
      }))
    }
  }

  if (options.publishimo) {
    /**
     * @type {import("publishimo-webpack-plugin").pluginOptions}
     */
    const publishimoConfig = {
      autoMain: options.type === "cli" ? "bin" : true,
      autoTypes: Boolean(options.documentation),
      banner: false,
    }
    if (options.nodeExternals === false) {
      publishimoConfig.excludeFields = [
        "dependencies",
        "optionalDependencies",
        "peerDependencies",
      ]
    }
    if (typeof options.publishimo === "object") {
      Object.assign(publishimoConfig, options.publishimo)
    }
    config.plugins.push(new PublishimoWebpackPlugin(publishimoConfig))
  }

  if (options.banner) {
    let pluginOptions
    if (options.banner === true) {
      pluginOptions = {}
    } else {
      pluginOptions = options.banner
    }
    config.plugins.push(new PkgBannerPlugin(pluginOptions))
  }

  if (options.include) {
    const patterns = ensureArray(options.include).map(value => {
      if (isString(value)) {
        return {
          from: value,
          noErrorOnMissing: true,
        }
      }
      return value
    })
    config.plugins.push(new CopyWebpackPlugin({patterns}))
  }

  if (isString(options.hashbang)) {
    config.plugins.push(new webpack.BannerPlugin({
      banner: ensureStart(options.hashbang.trim(), "#!"),
      raw: true,
    }))
  }

  if (!options.development) {
    if (options.terserOptions === false) {
      debug("terserOptions is false, skipping minification")
      config.optimization.minimize = false
    } else {
      debug("terserOptions: %o", options.terserOptions)
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: options.terserOptions,
          ...options.terserPluginOptions,
        }),
      ]
    }
  }

  if (!options.development && options.licenseFileName) {
    config.plugins.push(new LicenseWebpackPlugin({
      renderLicenses,
      outputFilename: options.licenseFileName,
      perChunkOutput: false, // This is important, combines the whole proeject's third party licenses into a single file, will throw a “Conflict: Multiple assets emit different content to the same filename” otherwise
    }))
  }

  if (options.excludeLocale) {
    config.plugins.push(new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }))
  }

  debug("Base config: %o", config)

  const extra = []

  const typeProviderWebpackConfig = typeProvider.getWebpackConfig({
    pkg,
    env,
    options,
    fromRoot,
    entryFolder,
    initialWebpackConfig: config,
  })

  if (hasContent(typeProviderWebpackConfig)) {
    extra.push(typeProviderWebpackConfig)
  }

  const typeProviderDefines = typeProvider.getDefines()
  if (hasContent(typeProviderDefines)) {
    config.plugins.push(new webpack.DefinePlugin(typeProviderDefines))
  }

  if (options.extra) {
    extra.push(options.extra)
  }

  if (options.extraProduction && !options.development) {
    extra.push(options.extraProduction)
  }

  if (options.extraDevelopment && options.development) {
    extra.push(options.extraDevelopment)
  }

  for (const [index, extraEntry] of extra.entries()) {
    debug("Extra config #%d: %o", index + 1, extraEntry)
  }

  const mergedConfig = extra.length ? webpackMerge(config, ...extra) : config

  if (process.env.webpackDevtool) {
    debug("Forced devtool from env: %s", process.env.webpackDevtool)
    mergedConfig.devtool = process.env.webpackDevtool
  }

  if (options.configOutput) {
    const outputFile = options.configOutput === true ? fromRoot("dist", "webpack-config-jaid", "webpackConfig.yml") : path.resolve(options.configOutput)
    outputYaml(outputFile, mergedConfig)
    const optionsOutputFile = path.resolve(outputFile, "..", "options.yml")
    outputYaml(optionsOutputFile, options)
    const pluginsOutputFile = path.resolve(outputFile, "..", "plugins.yml")
    const plugins = []
    for (const plugin of mergedConfig.plugins) {
      const pluginName = plugin.constructor?.name || "Untitled plugin"
      if (hasContent(plugin.options)) {
        plugins.push([pluginName, plugin.options])
      } else {
        plugins.push(pluginName)
      }
    }
    outputYaml(pluginsOutputFile, plugins)
  }

  debug("Final Webpack config: %o", mergedConfig)

  return mergedConfig
}