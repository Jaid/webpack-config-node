/* eslint-disable promise/prefer-await-to-callbacks */

import {execSync} from "child_process"
import path from "path"

import fs from "fs-extra"
import pify from "pify"
import webpack from "webpack"
import makeDir from "make-dir"
import coffee from "coffee"

import webpackConfigNode from "../build"

jest.setTimeout(60 * 1000)

const getProjectDir = name => {
  const packageRoot = path.join(__dirname, name)
  const outDir = path.join(packageRoot, "dist", String(Number(new Date)))
  return {
    packageRoot,
    outDir,
  }
}

const compile = async config => {
  const webpackConfig = webpackConfigNode(config)
  await makeDir(config.outDir)
  await fs.writeJson(path.join(config.outDir, "config.json"), webpackConfig)
  const stats = (await pify(webpack)(webpackConfig)).toJson()
  await fs.writeJson(path.join(config.outDir, "stats.json"), stats)
  return {
    webpackConfig,
    stats,
  }
}

it("should build a basic project in dev mode", async () => {
  const {packageRoot, outDir} = getProjectDir("basic")
  const {stats, webpackConfig} = await compile({
    packageRoot,
    outDir,
  })
  expect(webpackConfig).toMatchObject({
    target: "node",
    mode: "development",
    module: {
      rules: expect.arrayContaining([
        {
          test: /\.js$/,
          exclude: /node_modules\//,
          loader: "babel-loader",
        },
      ]),
    },
    resolve: {
      extensions: expect.arrayContaining([".js", ".json"]),
    },
    output: {
      filename: "index.js",
    },
  })
  expect(stats).toMatchObject({
    errors: [],
    warnings: [],
    hash: expect.stringMatching(/[\da-z]+/),
    assetsByChunkName: {
      main: "index.js",
    },
    assets: [
      {
        name: "index.js",
        chunks: ["main"],
        chunkNames: ["main"],
        emitted: true,
      },
    ],
  })
  const builtLib = require(outDir).default
  expect(typeof builtLib).toBe("function")
  expect(builtLib()).toBe(123)
})

it("should build a basic project in prod mode", async () => {
  const {packageRoot, outDir} = getProjectDir("basic")
  await compile({
    packageRoot,
    outDir,
    isDevelopment: false,
  })
  const builtLib = require(outDir).default
  expect(typeof builtLib).toBe("function")
  expect(builtLib()).toBe(123)
})

it("should build a project that uses a lib that is also built with webpack-config-node", async () => {
  const {packageRoot: libPackageRoot, outDir: libOutDir} = getProjectDir("basic")
  await compile({
    packageRoot: libPackageRoot,
    outDir: libOutDir,
    isDevelopment: false,
  })
  const packageRoot = path.join(libOutDir, "nested")
  const outDir = path.join(packageRoot, "dist")
  await makeDir(path.join(packageRoot, "src"))
  fs.writeJsonSync(path.join(packageRoot, "package.json"), {
    name: "webpack-config-node-test-nested",
    version: "1.0.0",
    author: "Jaid",
  })
  fs.writeFileSync(path.join(packageRoot, "src", "index.js"), "import lib from \"../..\"\nexport default x => 2 * lib()")
  await compile({
    packageRoot,
    outDir,
  })
  const builtLib = require(outDir).default
  expect(typeof builtLib).toBe("function")
  expect(builtLib(2)).toBe(246)
})


describe("should build a project with some external dependencies", () => {
  const packageRoot = path.join(__dirname, "depender")
  if (!fs.existsSync(path.join(packageRoot, "node_modules"))) {
    execSync(`cd "${packageRoot}" && npm install`)
  }
  it("development environment", async () => {
    const {outDir} = getProjectDir("depender")
    await compile({
      packageRoot,
      outDir,
      type: "cli",
      isDevelopment: true,
    })
    return coffee.fork(outDir)
      .expect("stdout", "My name is valid!\n")
      .expect("code", 0)
      .end()
  })
  it("production environment", async () => {
    const {outDir} = getProjectDir("depender")
    await compile({
      packageRoot,
      outDir,
      type: "cli",
      isDevelopment: false,
    })
    return coffee.fork(outDir)
      .expect("stdout", "My name is valid!\n")
      .expect("code", 0)
      .end()
  })
})