var assert = require('assert')

var createAuth = require('township-auth')
var basic = require('township-auth/basic')
var createAccess = require('township-access')
var createToken = require('township-token')
var cookie = require('cookie-cutter')
var xtend = require('xtend')

module.exports = function (db, config) {
  assert.equal(typeof db, 'object', 'leveldb instance required as first argument')
  assert.equal(typeof config, 'object', 'config object required')
  assert.equal(typeof config.name, 'string', 'config.name string required')

  var accounts = {}
  var auth = createAuth(db, { providers: { basic: basic } })
  var access = createAccess(db)
  var jwt = createToken(db, { secret: config.secret })

  /*
  * Hooks
  */
  var hooks = config.hooks || {}
  hooks.beforeRegister = hooks.beforeRegister || noop
  hooks.afterRegister = hooks.afterRegister || noop
  hooks.beforeUpdate = hooks.beforeUpdate || noop
  hooks.afterUpdate = hooks.afterUpdate || noop
  hooks.beforeDestroy = hooks.beforeDestroy || noop

  accounts.findByEmail = function findByEmail (email, callback) {
    auth.findOne('basic', email, function (err, account) {
      if (err || !account) return callback(new Error('Account with email ' + email + ' Not found'))
      return callback(null, account)
    })
  }

  accounts.register = function register (opts, callback) {
    assert.ok(opts.email, 'opts.email required')
    assert.ok(opts.password, 'opts.password required')
    // user-defined required opts?

    hooks.beforeRegister(opts, function (err, newOpts) {
      if (err) return callback(err)
      opts = xtend(opts, newOpts)

      accounts.findByEmail(opts.email, function (err, account) {
        if (!err && account) {
          return callback(new Error('Cannot create account with that email address'))
        } else {
          auth.create({ basic: opts }, function (err, authData) {
            if (err) return callback(err)

            access.create(authData.key, ['api:access'], function (err, accessData) {
              if (err) return callback(err)

              var token = jwt.sign({
                auth: authData,
                access: accessData
              })

              hooks.afterRegister({ key: authData.key, token: token }, callback)
            })
          })
        }
      })
    })
  }

  accounts.login = function login (opts, callback) {
    assert.equal(typeof opts.email, 'string', 'opts.email required')
    assert.equal(typeof opts.password, 'string', 'opts.password required')

    auth.verify('basic', opts, function (err, authData) {
      if (err) return callback(err)

      access.get(authData.key, function (err, accessData) {
        if (err) return callback(err)
        var token = jwt.sign({ auth: authData, access: accessData })
        callback(null, { key: authData.key, token: token })
      })
    })
  }

  accounts.logout = function logout (token, callback) {
    jwt.verify(token, function (err, account) {
      if (err && err.message === 'jwt expired') return callback()
      else if (err) return callback(err)
      jwt.invalidate(token, callback)
    })
  }

  accounts.destroy = function destroy (key, callback) {
    hooks.beforeDestroy(key, function (err) {
      if (err) return callback(err)
      auth.destroy(key, function (err) {
        if (err) return callback(err)
        access.destroy(key, function (err) {
          if (err) return callback(err)
          callback(null, key)
        })
      })
    })
  }

  accounts.resetPassword = function resetPassword (opts, callback) {
    assert.equal(typeof opts, 'opts object is required')
    assert.equal(typeof opts.key, 'string', 'opts.key string is required')
    assert.equal(typeof opts.email, 'string', 'opts.email string is required')
    assert.equal(typeof opts.password, 'string', 'opts.password string is required')
    assert.equal(typeof opts.newPassword, 'string', 'opts.newPassword string is required')

    var creds = {
      email: opts.email,
      password: opts.password
    }

    auth.verify('basic', creds, function (err, authData) {
      if (err) return callback(err)

      var updatedCreds = {
        key: authData.key,
        email: opts.email,
        password: opts.newPassword
      }

      auth.update(updatedCreds, callback)
    })
  }

  accounts.verifyScope = function verifyScope (account, scopes) {}

  /*
  * HTTP Request methods
  */

  accounts.verify = function verify (req, callback) {
    accounts.verifyToken(req, function (err, tokenData) {
      if (err) return callback(err)
      accounts.findByEmail(tokenData.auth.basic.email, function (err, account) {
        if (err) return callback(new Error('Account not found'))
        callback(null, tokenData)
      })
    })
  }

  accounts.verifyToken = function verifyToken (req, callback) {
    var token = accounts.getToken(req)
    if (!token || typeof token !== 'string') return callback(new Error('Not Authorized: token is required'))
    return jwt.verify(token, callback)
  }

  accounts.getToken = function getToken (req) {
    var authHeader = req.headers.authorization
    var token
    if (authHeader && authHeader.indexOf('Bearer') > -1) {
      token = authHeader.split('Bearer ')[1]
    } else if (req.headers.cookie) {
      token = cookie(req.headers.cookie).get(config.name + '_access_token')
    }
    return token
  }

  /*
  * HTTP Response methods
  */

  accounts.setCookie = function setCookie (res, options) {
    assert.equal(typeof res, 'object', 'response object is required')
    assert.equal(typeof options, 'object', 'options object is required')
    assert.equal(typeof options.hostname, 'string', 'options.hostname string is required')
    assert.equal(typeof options.token, 'string', 'options.token string is required')
    var token = options.token
    var hostname = options.hostname
    res.setHeader('Set-Cookie', config.name + '_access_token=' + token + '; ' + 'path=/; domain=' + hostname + '; HttpOnly')
  }

  accounts.removeCookie = function removeCookie (res) {
    assert.equal(typeof res, 'object', 'response object is required')
    res.setHeader('Set-Cookie', config.name + '_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT')
  }

  accounts.auth = auth
  accounts.access = access
  accounts.token = jwt
  return accounts
}

function noop (data, callback) { return callback(null, data) }
