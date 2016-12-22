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

  var accounts = {}
  var auth = createAuth(db, { providers: { basic: basic } })
  var access = createAccess(db, config)
  var jwt = createToken(db, config)

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

  accounts.register = function register (options, callback) {
    if (!options.email) return callback(new Error('options.email required'))
    if (!options.password) return callback(new Error('options.password required'))
    options.scopes = options.scopes || []

    hooks.beforeRegister(options, function (err, hookOptions) {
      if (err) return callback(err)
      options = xtend(options, hookOptions)

      accounts.findByEmail(options.email, function (err, account) {
        if (!err && account) return callback(new Error('Cannot create account with that email address'))

        auth.create({ basic: options }, function (err, authData) {
          if (err) return callback(err)

          access.create(authData.key, options.scopes, function (err, accessData) {
            if (err) return callback(err)

            var token = jwt.sign({
              auth: authData,
              access: accessData
            })

            hooks.afterRegister({ key: authData.key, token: token }, callback)
          })
        })
      })
    })
  }

  accounts.login = function login (options, callback) {
    if (!options || typeof options !== 'object') {
      return cb(new Error('email and password properties required'), 400)
    }

    var email = options.email
    var password = options.password

    if (!email) {
      return cb(new Error('email property required'), 400)
    } else if (!password) {
      return cb(new Error('password property required'), 400)
    }

    auth.verify('basic', options, function (err, authData) {
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
    if (!key || typeof key !== 'object') return callback(new Error('options object is required'))

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

  accounts.updatePassword = function updatePassword (options, callback) {
    if (typeof options !== 'object') return callback(new Error('options object is required'))
    if (typeof options.email !== 'string') return callback(new Error('options.email string is required'))
    if (typeof options.password !== 'string') return callback(new Error('options.password string is required'))
    if (typeof options.newPassword !== 'string') return callback(new Error('options.newPassword string is required'))
    if (typeof options.token !== 'object') return callback(new Error('options.token object is required'))
    if (typeof options.token.access !== 'object') return callback(new Error('options.token.access object is required'))
    if (typeof options.rawToken !== 'string') return callback(new Error('options.rawToken string is required'))

    var creds = {
      email: options.email,
      password: options.password
    }

    auth.verify('basic', creds, function (err, authData) {
      if (err) return callback(err)

      var updatedCreds = {
        key: authData.key,
        basic: {
          email: options.email,
          password: options.newPassword
        }
      }

      auth.update(updatedCreds, function (err, authData) {
        if (err) return callback(err)

        var newToken = jwt.sign({
          auth: authData,
          access: options.token.access
        })

        jwt.invalidate(options.rawToken, function (err) {
          if (err) return callback(err)
          callback(null, { key: authData.key, token: newToken })
        })
      })
    })
  }

  accounts.authorize = function authorize (account, scopes) {}

  /*
  * HTTP Request methods
  */

  accounts.verify = function verify (req, callback) {
    accounts.verifyToken(req, function (err, tokenData, token) {
      if (err) return callback(err)
      accounts.findByEmail(tokenData.auth.basic.email, function (err, account) {
        if (err) return callback(new Error('Account not found'))
        callback(null, tokenData, token)
      })
    })
  }

  accounts.verifyToken = function verifyToken (req, callback) {
    var token = accounts.getToken(req)
    if (!token || typeof token !== 'string') return callback(new Error('Not Authorized: token is required'))
    return jwt.verify(token, function (err, tokenData) {
      if (err) return callback(err)
      callback(null, tokenData, token)
    })
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
