import fss from "@absolunet/fss"
import CnamePlugin from "cname-webpack-plugin"
import ensureStart from "ensure-start"
import HtmlFaviconPlugin from "html-favicon-webpack-plugin"
import {isObject, omit, uniq} from "lodash"
import LogWatcherPlugin from "log-watcher-webpack-plugin"
import OfflinePlugin from "offline-plugin"
import OptimizeCssAssetsPlugin from "optimize-css-assets-webpack-plugin"
import RobotsTxtPlugin from "robotstxt-webpack-plugin"
import SitemapXmlPlugin from "sitemap-xml-webpack-plugin"
import urlJoin from "url-join"
import webpackMerge from "webpack-merge"
import PwaManifestPlugin from "webpack-pwa-manifest"

import Html from "src/types/html"

const debug = require("debug")(_PKG_NAME)

export default class extends Html {

  /**
   * @type {string}
   */
  themeColor = null

  /**
   * @type {string}
   */
  backgroundColor = null

  /**
   * @function
   * @param {import("../WebpackConfigType").GetDefaultOptionsContext} context
   * @return {import("src/index").WebpackConfigJaidOptions}
   */
  getDefaultOptions() {
    const parentOptions = super.getDefaultOptions()
    return {
      ...parentOptions,
      inlineSource: false,
      sitemap: true,
      offline: true,
      pwa: true,
      banner: true,
    }
  }

  /**
   * @return {string}
   */
  getPublicPath() {
    if (this.options.publicPath) {
      return this.options.publicPath
    } else if (this.isHot()) {
      return `http://localhost:${this.port}/`
    } else {
      return "/"
    }
  }

  /**
   * @return {Object}
   */
  getMeta() {
    const parentMeta = super.getMeta()
    const meta = {
      ...parentMeta,
      HandheldFriendly: true,
    }
    if (!this.options.development) {
      meta.description = this.description
      meta["format-detection"] = "telephone=no"
      meta["og:type"] = "website"
      meta["twitter:card"] = "summary"
      meta["og:updated_time"] = Date.now()
      meta["og:determiner"] = ""
      meta["og:description"] = this.description
      meta["twitter:description"] = this.description
      meta["og:title"] = this.title
      meta["twitter:title"] = this.title
      if (this.pkg.author?.name) {
        meta.author = this.pkg.author?.name
      }
      if (this.options.locale) {
        meta["og:locale"] = this.options.locale.replace("-", "_")
      }
      if (this.options.twitterSiteHandle || this.options.twitterAuthorHandle) {
        meta["twitter:site"] = ensureStart(this.options.twitterSiteHandle || this.options.twitterAuthorHandle, "@")
      }
      if (this.options.twitterAuthorHandle) {
        meta["twitter:creator"] = ensureStart(this.options.twitterAuthorHandle, "@")
      }
      if (this.options.domain && this.options.pwa) {
        const baseUrl = `https://${this.options.domain}`
        const metaIconSize = 384
        const imageUrl = urlJoin(baseUrl, `icon_${metaIconSize}x${metaIconSize}.png`)
        meta["og:url"] = baseUrl
        meta["og:image:width"] = metaIconSize
        meta["og:image:height"] = metaIconSize
        meta["og:image:type"] = "image/png"
        meta["og:image"] = imageUrl
        meta["twitter:image"] = imageUrl
      }
    }
    return meta
  }

  /**
   * @return {boolean}
   */
  shouldInlineJavascript() {
    return false
  }

  /**
   * @return {import("webpack").Loader}
   */
  getImageLoader() {
    if (this.options.development) {
      return super.getImageLoader()
    }
    return {
      test: this.getImageFileRegex(),
      oneOf: [
        {
          resourceQuery: /\?raw/,
          use: omit(super.getImageLoader(), "test"),
        },
        {
          loader: "modern-image-loader",
        },
      ],
    }
  }

  /**
   * @return {string}
   */
  getBodyContent() {
    const text = this.title || this.pkg?.name || this.domain || "Loading"
    const textColor = "#8888"
    return `<div><main style="position:fixed;margin:0;padding:0;width:100vw;height:100vh;color:${textColor};display:flex;justify-content:center;align-items:center;font-size:200%;font-family:Ubuntu,sans-serif"><span>${text}</span></main></div>`
  }

  /**
   * @return {Object}
   */
  getCnamePluginOptions() {
    return {
      domain: this.domain,
    }
  }

  /**
   * @return {Object}
   */
  getRobotsTxtPluginOptions() {
    if (isObject(this.options.robots)) {
      return this.options.robots
    }
    return {
      host: `https://${this.domain}`,
      sitemap: `https://${this.domain}/sitemap.xml`,
    }
  }

  /**
   * @return {import("sitemap-xml-webpack-plugin").pluginOptions}
   */
  getSitemapXmlPluginOptions() {
    const pluginOptions = {
      domain: this.domain,
    }
    if (isObject(this.options.sitemap)) {
      Object.assign(pluginOptions, this.options.sitemap)
    }
    return pluginOptions
  }

  /**
   * @return {import("optimize-css-assets-webpack-plugin").Options}
   */
  getOptimizeCssAssetsPluginOptions() {
    if (isObject(this.options.optimizeCss)) {
      return this.options.optimizeCss
    }
    if (this.options.optimizeCss === true) {
      return {
        cssProcessorPluginOptions: {
          preset: [
            "advanced",
            {
              discardComments: {removeAll: true},
            },
          ],
        },
      }
    }
    return null
  }

  /**
   * @return {string}
   */
  getThemeColor() {
    if (this.options.themeColor) {
      return ensureStart(this.options.themeColor, "#")
    }
    return "#00CC00"
  }

  /**
   * @return {string}
   */
  getBackgroundColor() {
    if (this.options.backgroundColor) {
      return ensureStart(this.options.backgroundColor, "#")
    }
    return "#000000"
  }

  /**
   * @return {import("webpack-pwa-manifest").ManifestOptions}
   */
  getPwaManifestPluginOptions() {
    if (isObject(this.options.pwa)) {
      return this.options.pwa
    }
    /**
     * @type {import("webpack-pwa-manifest").ManifestOptions}
     */
    const pluginOptions = {
      description: this.description,
      orientation: "portrait",
      display: "standalone",
      name: this.title,
      inject: true,
      fingerprints: false,
      theme_color: this.themeColor,
      background_color: this.backgroundColor,
      ios: {
        "apple-mobile-web-app-title": this.title,
        "apple-mobile-web-app-status-bar-style": "black-translucent",
      },
      start_url: `https://${this.options.domain}`,
      publicPath: `https://${this.options.domain}`,
      icons: [
        {
          src: this.iconFile,
          sizes: [
            16,
            24,
            32,
            64,
            80,
            92,
            128,
            192,
            256,
            384,
            512,
          ],
        },
      ],
    }
    if (this.options.development) {
      pluginOptions.start_url = "."
    } else {
      pluginOptions.start_url = `https://${this.options.domain}`
      pluginOptions.publicPath = `https://${this.options.domain}`
    }
    return pluginOptions
  }

  /**
   * @return {import("html-favicon-webpack-plugin").Options}
   */
  getHtmlFaviconPluginOptions() {
    return {
      href: urlJoin(this.publicPath, "icon_128x128.png"), // TODO: Replace with shorter name, see https://github.com/arthurbergmz/webpack-pwa-manifest/issues/36#issuecomment-568140796
    }
  }

  getOfflinePluginOptions() {
    return {
      safeToUseOptionalCaches: true,
      appShell: "index.html",
      caches: {
        main: [
          "*.js",
          "*.css",
          "*.html",
          "manifest.json",
        ],
        additional: [
          "*.woff",
          "*.woff2",
          "*.jpg",
          "*.jpeg",
          "*.png",
          "*.webp",
        ],
        optional: [":rest:"],
      },
      ServiceWorker: {
        events: true,
      },
      AppCache: {
        events: true,
      },
      excludes: [
        "**/*.txt",
        "CNAME",
      ],
      version: this.pkg.version || String(Date.now()),
    }
  }

  /**
   * @param {import("src/types/WebpackConfigType").GetWebpackConfigContext} context
   * @return {import("webpack").Configuration}
   */
  getWebpackConfig(context) {
    const {fromRoot, initialWebpackConfig} = context
    this.iconFile = fromRoot("icon.png")
    debug(`Using icon ${this.iconFile}`)
    this.description = this.getDescription()
    this.themeColor = this.getThemeColor()
    this.backgroundColor = this.getBackgroundColor()
    const iconFileExists = fss.pathExists(this.iconFile)
    if (!iconFileExists) {
      throw new Error(`File ${this.iconFile} not found`)
    }
    const parentConfig = super.getWebpackConfig(context)
    this.domain = this.options.domain
    /**
     * @type {import("webpack").Configuration}
     */
    let webpackConfig = {
      plugins: [],
    }
    if (this.hot) {
      // Need to ignore both front slash versions and back slash versions of paths for Windows support
      const ignoredPaths = [
        fromRoot("dist"),
        fromRoot("dist").replace(/\\/g, "/"),
        fromRoot(".git"),
        fromRoot(".git").replace(/\\/g, "/"),
      ]
      webpackConfig = webpackMerge.smart(webpackConfig, {
        watch: true,
        watchOptions: {
          ignored: uniq(ignoredPaths),
        },
        entry: [
          "react-hot-loader/patch",
          `webpack-dev-server/client?http://localhost:${this.port}/`,
          "webpack/hot/only-dev-server",
          initialWebpackConfig.entry,
        ],
        devServer: {
          publicPath: this.publicPath,
          port: this.port,
          hot: true,
          overlay: true,
          headers: {"Access-Control-Allow-Origin": "*"},
          historyApiFallback: {
            verbose: true,
            disableDotRule: false,
          },
        },
        resolve: {
          alias: {
            "react-dom": "@hot-loader/react-dom",
          },
        },
      })
      webpackConfig.plugins.push(new LogWatcherPlugin)
    }
    webpackConfig.plugins.push(new HtmlFaviconPlugin(this.getHtmlFaviconPluginOptions()))
    if (!this.options.development) {
      webpackConfig.plugins.push(new PwaManifestPlugin(this.getPwaManifestPluginOptions()))
      webpackConfig.plugins.push(new CnamePlugin(this.getCnamePluginOptions()))
      webpackConfig.plugins.push(new RobotsTxtPlugin(this.getRobotsTxtPluginOptions()))
      webpackConfig.plugins.push(new SitemapXmlPlugin(this.getSitemapXmlPluginOptions()))
      const optimizeCssAssetsPluginOptions = this.getOptimizeCssAssetsPluginOptions()
      if (optimizeCssAssetsPluginOptions !== null) {
        webpackConfig.plugins.push(new OptimizeCssAssetsPlugin(optimizeCssAssetsPluginOptions))
      }
      webpackConfig.plugins.push(new OfflinePlugin(this.getOfflinePluginOptions()))
    }
    return webpackMerge.smart(parentConfig, webpackConfig)
  }

}