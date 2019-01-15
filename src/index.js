import path from "path"

import readPkg from "read-pkg"
import webpackMerge from "webpack-merge"
import appRootPath from "app-root-path"
import {isString, isObject, camelCase} from "lodash"
import FriendlyErrorsWebpackPlugin from "friendly-errors-webpack-plugin"
import LodashWebpackPlugin from "lodash-webpack-plugin"
import {BannerPlugin, EnvironmentPlugin} from "webpack"

import Credits from "./Credits"

export default options => {
  options = {
    packageRoot: String(appRootPath),
    isDevelopment: true,
    extra: null,
    type: "lib",
    ...options,
  }

  const fromPackage = directive => path.resolve(options.packageRoot, directive)
  const pkg = readPkg.sync({
    cwd: options.packageRoot,
  })

  const config = {
    target: "node",
    context: options.packageRoot,
    resolve: {
      extensions: [".js", ".json", ".yml"],
    },
    mode: options.isDevelopment ? "development" : "production",
    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: "post",
          resourceQuery: /\?aot$/,
          loader: "aot-loader",
        },
        {
          test: /\.js$/,
          exclude: /node_modules\//,
          loader: "babel-loader",
        },
        {
          test: /\.ya?ml$/,
          loader: "yml-loader",
        },
      ],
    },
    plugins: [new FriendlyErrorsWebpackPlugin],
    output: {
      path: path.resolve(options.packageRoot, "dist"),
      filename: "index.js",
    },
    optimization: {
      noEmitOnErrors: true,
    },
  }

  if (options.isDevelopment) {
    Object.assign(config.output, {
      auxiliaryComment: {
        root: "[Exposing Section] root",
        commonjs: "[Exposing Section] commonjs",
        commonjs2: "[Exposing Section] commonjs2",
        amd: "[Exposing Section] amd",
      },
    })
  } else {
    config.plugins = [
      ...config.plugins,
      new BannerPlugin({
        banner: String(new Credits(pkg)),
        entryOnly: true,
      }),
      // new LodashWebpackPlugin({
      //   shorthands: true,
      //   flattening: true,
      // }),
    ]
  }

  if (options.type) {
    require(`./types/${options.type}`)({
      config,
      options,
      pkg,
      fromPackage,
    })
  }

  if (options.extra) {
    return webpackMerge.smart(config, options.extra)
  } else {
    return config
  }
}