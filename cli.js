#!/usr/bin/env node
var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')
var shell = require('shelljs')
var cfg = require('./index')
var runtime = cfg.runtime
var nodemon = cfg.nodemon
var debug = require('depurar')('lanyon')

var scripts = {
  'build:assets': 'webpack --config [lanyonDir]/webpack.config.js',
  'build:content:incremental': 'jekyll build --incremental --source [projectDir] --destination [contentBuildDir] --config [projectDir]/_config.yml,[lanyonDir]/_config.dev.yml',
  'build:content': 'jekyll build --source [projectDir] --destination [contentBuildDir] --config [projectDir]/_config.yml,[lanyonDir]/_config.dev.yml',
  'build': '[lanyon] build:assets && [lanyon] build:content', // <-- parrallel won't work for production builds, jekyll needs to copy assets into _site
  'console': 'docker run -i -t kevinvz/lanyon sh',
  'help': 'jekyll build --help',
  'postinstall': 'node [lanyonDir]/postinstall.js',
  'serve': 'browser-sync start --config [lanyonDir]/browsersync.config.js',
  'start': '[lanyon] build:content:incremental && parallelshell "[lanyon] build:content:watch" "[lanyon] serve"',
  'build:content:watch': 'nodemon --config [lanyonDir]/nodemon.config.json --exec "[lanyon] build:content:incremental' + '"'
}

var cmdName = process.argv[2]
var cmd = scripts[cmdName]

if (!cmd) {
  console.error('"' + cmdName + '" is not a valid Lanyon command. Pick from: ' + Object.keys(scripts).join(', ') + '.')
}

fs.writeFileSync(runtime.lanyonDir + '/nodemon.config.json', JSON.stringify(nodemon, null, '  '), 'utf-8')
fs.writeFileSync(runtime.lanyonDir + '/fullthing.json', JSON.stringify(cfg, null, '  '), 'utf-8')
debug(cfg)

if (cmdName.match(/^build/)) {
  if (!shell.test('-d', runtime.assetsBuildDir)) {
    shell.mkdir('-p', runtime.assetsBuildDir)
  }
  if (!shell.test('-d', runtime.cacheDir)) {
    shell.mkdir('-p', runtime.cacheDir)
    shell.exec('cd ' + path.dirname(runtime.cacheDir) + ' && git ignore ' + path.basename(runtime.cacheDir))
  }
}

var env = process.env
env.NODE_ENV = runtime.lanyonEnv
env.JEKYLL_ENV = runtime.lanyonEnv
env.LANYON_PROJECT = runtime.projectDir // <-- to preserve the cwd over multiple nested executes, if it wasn't initially set

cmd = cmd.replace(/\[lanyon]/g, 'node ' + __filename)
cmd = cmd.replace(/\[lanyonDir]/g, runtime.lanyonDir)
cmd = cmd.replace(/\[contentBuildDir]/g, runtime.contentBuildDir)
cmd = cmd.replace(/\[projectDir]/g, runtime.projectDir)
cmd = cmd.replace(/(\s|^)browser-sync(\s|$)/, '$1' + runtime.lanyonDir + '/node_modules/.bin/browser-sync$2')
cmd = cmd.replace(/(\s|^)webpack(\s|$)/, '$1' + runtime.lanyonDir + '/node_modules/.bin/webpack$2')
cmd = cmd.replace(/(\s|^)nodemon(\s|$)/, '$1' + runtime.lanyonDir + '/node_modules/.bin/nodemon$2')
cmd = cmd.replace(/(\s|^)npm-run-all(\s|$)/, '$1' + runtime.lanyonDir + '/node_modules/.bin/npm-run-all$2')
cmd = cmd.replace(/(\s|^)parallelshell(\s|$)/, '$1' + runtime.lanyonDir + '/node_modules/.bin/parallelshell$2')
cmd = cmd.replace(/(\s|^)jekyll(\s|$)/, '$1' + runtime.lanyonDir + '/vendor/bin/jekyll$2')

console.log(cmd)
var child = spawn('sh', ['-c', cmd], {
  'stdio': 'inherit',
  'env': env,
  'cwd': __dirname
})

child.on('exit', function (code) {
  if (code !== 0) {
    console.error('Child exited with code ' + code)
    process.exit(1)
  }
  console.log('Done. ')
})