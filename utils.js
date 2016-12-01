var semver = require('semver')
var chalk = require('chalk')
var fs = require('fs')
var _ = require('lodash')
var path = require('path')
var yaml = require('js-yaml')
var shell = require('shelljs')
var no = chalk.red('✗ ')
var yes = chalk.green('✓ ')
var spawnSync = require('spawn-sync')

module.exports.preferLocalPackage = function (args, filename, appDir, name, entry, version) {
  var localModulePackage
  var absoluteEntry
  try {
    localModulePackage = require(appDir + '/node_modules/' + name + '/package.json')
    absoluteEntry = fs.realpathSync(appDir + '/node_modules/' + name + '/' + entry)
  } catch (e) {
    localModulePackage = {}
    absoluteEntry = false
  } finally {
    if (localModulePackage.version && absoluteEntry) {
      if (filename === absoluteEntry) {
        console.log('--> Booting symlinked ' + name + ' v' + localModulePackage.version)
      } else {
        console.log('--> Booting local ' + name + ' v' + localModulePackage.version)
        var exe = args.shift()
        for (var i in args) {
          // Replace the current entry, e.g. /usr/local/frey/cli.js with the local package
          if (args[i] === filename) {
            args[i] = absoluteEntry
          }
        }
        spawnSync(exe, args, { stdio: 'inherit' })
        process.exit(0)
      }
    } else {
      console.log('--> Booting local ' + name + ' v' + version)
    }
  }
}

module.exports.dockerCmd = function (runtime, cmd, flags) {
  if (!flags) {
    flags = ''
  }
  return [
    'docker run',
    ' ' + flags,
    ' --rm',
    ' --workdir ' + runtime.cacheDir,
    ' --user $(id -u)',
    ' --volume ' + runtime.cacheDir + ':' + runtime.cacheDir,
    ' --volume ' + runtime.projectDir + ':' + runtime.projectDir,
    ' kevinvz/lanyon:' + runtime.lanyonVersion + '',
    ' ' + cmd
  ].join('')
}

module.exports.upwardDirContaining = function (find, cwd) {
  if (!cwd) {
    cwd = process.env.PWD || process.cwd()
  }
  var parts = cwd.split('/')
  while (parts.length) {
    var newParts = parts
    var ppath = newParts.join('/') + '/' + find
    if (shell.test('-f', ppath) || shell.test('-d', ppath)) {
      return path.dirname(ppath)
    }
    parts.pop()
  }
  return false
}

module.exports.initProject = function (runtime) {
  if (!shell.test('-d', runtime.assetsBuildDir)) {
    shell.mkdir('-p', runtime.assetsBuildDir)
    shell.exec('cd ' + path.dirname(runtime.cacheDir) + ' && git ignore ' + path.relative(runtime.gitRoot, runtime.assetsBuildDir))
  }
  if (!shell.test('-d', runtime.cacheDir)) {
    shell.mkdir('-p', runtime.cacheDir)
    shell.exec('cd ' + path.dirname(runtime.cacheDir) + ' && git ignore ' + path.relative(runtime.gitRoot, runtime.cacheDir))
  }
  if (!shell.test('-d', runtime.binDir)) {
    shell.mkdir('-p', runtime.binDir)
    shell.exec('cd ' + path.dirname(runtime.binDir) + ' && git ignore ' + path.relative(runtime.gitRoot, runtime.binDir))
  }
}

module.exports.writeConfig = function (cfg) {
  fs.writeFileSync(cfg.runtime.cacheDir + '/jekyll.config.yml', yaml.safeDump(cfg.jekyll), 'utf-8')
  fs.writeFileSync(cfg.runtime.cacheDir + '/nodemon.config.json', JSON.stringify(cfg.nodemon, null, '  '), 'utf-8')
  fs.writeFileSync(cfg.runtime.cacheDir + '/full-config-dump.json', JSON.stringify(cfg, null, '  '), 'utf-8')
  fs.writeFileSync(cfg.runtime.cacheDir + '/browsersync.config.js', 'module.exports = require("' + cfg.runtime.lanyonDir + '/config.js").browsersync', 'utf-8')
  fs.writeFileSync(cfg.runtime.cacheDir + '/webpack.config.js', 'module.exports = require("' + cfg.runtime.lanyonDir + '/config.js").webpack', 'utf-8')
  shell.cp(path.join(cfg.runtime.lanyonDir, 'Dockerfile'), path.join(cfg.runtime.cacheDir, 'Dockerfile'))
  var buf = 'source \'https://rubygems.org\'\n'
  for (var name in cfg.runtime.gems) {
    var version = cfg.runtime.gems[name]
    buf += 'gem \'' + name + '\', \'' + version + '\'\n'
  }
  fs.writeFileSync(path.join(cfg.runtime.cacheDir, 'Gemfile'), buf, 'utf-8')
}

module.exports.passthru = function (runtime, cmd, opts) {
  if (_.isArray(cmd)) {
    cmd = cmd.join(' ')
  }

  opts = _.defaults(opts, {
    'stdio': 'inherit', // ignore
    'cwd': runtime.cacheDir
  })

  var p = spawnSync('sh', ['-c', cmd], opts)
  if (p.error || p.status !== 0) {
    console.error('Error while executing "' + cmd + '". ')
    process.exit(1)
  }
}

module.exports.fatalExe = function (cmd) {
  if (_.isArray(cmd)) {
    cmd = cmd.join(' ')
  }
  var opts = { 'silent': true }

  process.stdout.write('--> Executing: ' + cmd + ' ... ')

  var p = shell.exec(cmd, opts)
  if (p.code !== 0) {
    console.log(no)
    console.error('Failed to execute: ' + cmd)
    console.error(p.stdout)
    console.error(p.stderr)
    shell.exit(1)
  }

  console.log(yes)

  return p.stdout.trim()
}

module.exports.satisfied = function (runtime, app, cmd, checkOn) {
  var tag = ''
  if (checkOn === undefined) {
    checkOn = app
  } else {
    tag = checkOn + '/'
  }

  process.stdout.write('--> Checking: ' + tag + app + ' \'' + runtime.prerequisites[app].range + '\' ... ')

  if (runtime.rubyProvidersSkip.indexOf(checkOn) !== -1) {
    console.log(no + ' (disabled via LANYON_SKIP)')
    return false
  }

  if (!cmd) {
    cmd = app + ' -v'
  }

  var appVersionFull = shell.exec(cmd, { 'silent': false }).stdout.trim()
  var parts = appVersionFull.split(/[,p\s-]+/)
  var appVersion = parts[1]

  if (app === 'node') {
    appVersion = parts[0]
  } else if (app === 'bundler') {
    appVersion = parts[2]
  } else if (app === 'docker') {
    appVersion = parts[2]
  }

  try {
    if (semver.satisfies(appVersion, runtime.prerequisites[app].range)) {
      console.log(yes + appVersion + ' (' + appVersionFull + ')')
      return true
    }
  } catch (e) {
    console.log(no + cmd + ' returned: "' + appVersionFull + '". ' + e)
    return false
  }

  console.log(no + appVersion + ' (' + appVersionFull + ')')
  return false
}
