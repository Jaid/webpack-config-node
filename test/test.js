import fss from "@absolunet/fss"
import ms from "ms.macro"
import path from "path"
import pify from "pify"
import sortKeys from "sort-keys"

const webpack = pify(require("webpack"))
const getFolderSize = pify(require("get-folder-size"))

const indexModule = process.env.MAIN ? path.resolve(__dirname, "..", process.env.MAIN) : path.join(__dirname, "..", "src")
const webpackConfigJaid = require(indexModule)

const setupTest = (name, packageRoot) => {
  const timeout = ms`10 minutes`
  describe(name, () => {
    for (const env of ["development", "production"]) {
      it(env, async () => {
        const configPath = path.join(packageRoot, "webpack.config.js")
        const jaidConfigPath = path.join(packageRoot, "jaidConfig.js")
        const expectScriptPath = path.join(packageRoot, "expect.js")
        const outDir = path.join(__dirname, "..", "dist", "test", name, env)
        const packageOutDir = path.join(outDir, "package")
        const outputObject = (key, value) => fss.outputJson5(path.join(outDir, `${key}.json5`), sortKeys(value, {deep: true}), {space: 2})
        const development = env !== "production"
        const startTime = Date.now()
        let webpackConfig
        if (fss.pathExists(configPath)) {
          webpackConfig = require(configPath).default(webpackConfigJaid, packageRoot, packageOutDir, development)
        } else if (fss.pathExists(jaidConfigPath)) {
          const importedJaidConfig = require(jaidConfigPath).default(webpackConfigJaid, packageRoot, packageOutDir, development)
          const jaidConfig = {
            packageRoot,
            development,
            outDir: packageOutDir,
            ...importedJaidConfig,
          }
          outputObject("jaidConfig", jaidConfig)
          webpackConfig = webpackConfigJaid.default(jaidConfig)
        } else {
          webpackConfig = webpackConfigJaid.configureNodeLib({
            packageRoot,
            development,
            outDir: packageOutDir,
          })
        }
        outputObject("webpack.config", webpackConfig)
        const stats = await webpack(webpackConfig)
        const benchmark = {
          seconds: (Date.now() - startTime) / 1000,
        }
        try {
          const packageSize = await getFolderSize(packageOutDir)
          benchmark.packageKb = packageSize / 1000
          benchmark.codeKb = fss.stat(path.join(packageOutDir, "index.js")).size / 1000
        } catch {}
        outputObject("benchmark", benchmark)
        const statsJson = stats.toJson()
        expect(statsJson.errors).toEqual([])
        outputObject("stats", statsJson)
        if (fss.pathExists(expectScriptPath)) {
          const selfTest = require(expectScriptPath)
          selfTest.default({
            name,
            packageRoot,
            stats,
            benchmark,
            webpackConfig,
            outDir,
            packageOutDir,
          })
        }
      }, timeout)
    }
  })
}

for (const entry of fss.readdir(__dirname)) {
  const entryPath = path.join(__dirname, entry)
  if (fss.stat(entryPath).isDirectory()) {
    setupTest(entry, entryPath)
  }
}