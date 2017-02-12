var assert = require('assert')

var createAuth = require('township-auth')
var basic = require('township-auth/basic')
var createAccess = require('township-access')
var createToken = require('township-token')
var xtend = require('xtend')

/**
* Create an accounts object
* @name townshipAccounts
* @param {Object} db – instance of a level db. See https://npmjs.com/level
* @param {Object} config – configuration object
* @example
*
* var townshipAccounts = require('township-accounts')
* var level = require('level')
* var db = level('db')
*
* var accounts = townshipAccounts(db, {
*   secret: 'not a secret'
* })
**/
module.exports = function townshipAccounts (db, config) {
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
  hooks.beforeDestroy = hooks.beforeDestroy || noop

  /**
  * Create an account
  * @name register
  * @param {Object} options – email address that corresponds to an account
  * @param {String} options.email – email address that corresponds to an account
  * @param {String} options.password – password that corresponds to an account
  * @param {Array} options.scopes – access scopes for an account
  * @param {Function} callback – callback function called with `error` and `accountData` arguments
  * @example
  *
  * var creds = {
  *   email: 'user@example.com',
  *   password: 'notverysecret',
  *   scopes: ['example:read']
  * }
  *
  * accounts.register(creds, function (err, account) {
  *   if (err) return console.log(err)
  *   console.log(account.key, account.token)
  * })
  **/
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

            var account = { key: authData.key, token: token }

            hooks.afterRegister(account, function (err, data) {
              if (err) return callback(err)
              return callback(null, data)
            })
          })
        })
      })
    })
  }

  /**
  * Log in to an account
  * @name login
  * @param {Object} options – email address that corresponds to an account
  * @param {String} options.email – email address that corresponds to an account
  * @param {String} options.password – password that corresponds to an account
  * @param {Function} callback – callback function called with `error` and `account` arguments
  * @example
  *
  * var creds = {
  *   email: 'user@example.com',
  *   password: 'notverysecret'
  * }
  *
  * accounts.login(creds, function (err, account) {
  *   if (err) return console.log(err)
  *   console.log(account.key, account.token)
  * })
  **/
  accounts.login = function login (options, callback) {
    if (!options || typeof options !== 'object') {
      return callback(new Error('email and password properties required'), 400)
    }

    var email = options.email
    var password = options.password

    if (!email) {
      return callback(new Error('email property required'), 400)
    } else if (!password) {
      return callback(new Error('password property required'), 400)
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

  /**
  * Log out of an account
  * @name logout
  * @param {String} token – the active token for an account
  * @param {Function} callback – callback function called with an `error` argument
  * @example
  *
  * accounts.logout(token, function (err) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.logout = function logout (token, callback) {
    jwt.verify(token, function (err, account) {
      if (err && err.message === 'jwt expired') return callback()
      else if (err) return callback(err)
      jwt.invalidate(token, callback)
    })
  }

  /**
  * Destroy an account
  * @name logout
  * @param {String} key – the key for an account
  * @param {Function} callback – callback function called with an `error` argument
  * @example
  *
  * accounts.destroy(token, function (err) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.destroy = function destroy (key, callback) {
    if (!key || typeof key !== 'string') return callback(new Error('account key is required'))

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

  /**
  * Find an account by email
  * @name findbyEmail
  * @param {String} email – email address that corresponds to an account
  * @param {Function} callback – callback function called with `error` and `accountData` arguments
  * @example
  *
  * accounts.findByEmail('user@example.com', function (err, accountData) {
  *   if (err) return console.log(err)
  *   console.log(accountData)
  * })
  **/
  accounts.findByEmail = function findByEmail (email, callback) {
    auth.findOne('basic', email, function (err, authData) {
      if (err || !authData) return callback(new Error('Account not found'))
      access.get(authData.key, function (err, accessData) {
        if (err) return callback(err)
        callback(null, { key: authData.key, access: accessData, auth: authData })
      })
    })
  }

  /**
  * Update password of an account
  * @name updatePassword
  * @param {Object} options – email address that corresponds to an account
  * @param {String} options.email – email address that corresponds to an account
  * @param {String} options.password – password that corresponds to an account
  * @param {String} options.newPassword – new password for an account
  * @param {Function} callback – callback function called with `error` and `account` arguments
  * @example
  *
  * var creds = {
  *   email: 'user@example.com',
  *   password: 'notverysecret',
  *   newPassword: 'still not very secret',
  *   token: token
  * }
  *
  * accounts.updatePassword(creds, function (err, account) {
  *   if (err) return console.log(err)
  *   console.log(account.key, account.token)
  * })
  **/
  accounts.updatePassword = function updatePassword (options, callback) {
    if (typeof options !== 'object') return callback(new Error('options object is required'))
    if (typeof options.email !== 'string') return callback(new Error('options.email string is required'))
    if (typeof options.password !== 'string') return callback(new Error('options.password string is required'))
    if (typeof options.newPassword !== 'string') return callback(new Error('options.newPassword string is required'))

    var creds = {
      email: options.email,
      password: options.password
    }

    accounts.findByEmail(options.email, function (err, account) {
      if (err) return callback(err)

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
            access: account.access
          })

          callback(null, { key: authData.key, token: newToken })
        })
      })
    })
  }

  /**
  * Authorize account using access scopes
  * @name authorize
  * @param {String} accountKey – the key for an account
  * @param {Array} scopes – the scopes your are checking for in the account's access permissions
  * @param {Function} callback – callback function called with an `error` argument
  * @example
  *
  * accounts.authorize(key, ['example:read'], function (err) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.authorize = function authorize (accountKey, scopes, callback) {
    access.verify(accountKey, scopes, callback)
  }

  /**
  * Authorize account using access scopes via their email
  * @name authorizeByEmail
  * @param {String} email – the email address associated with an account
  * @param {Array} scopes – the scopes your are checking for in the account's access permissions
  * @param {Function} callback – callback function called with an `error` argument
  * @example
  *
  * accounts.authorizeByEmail('user@example.com', ['example:read'], function (err) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.authorizeByEmail = function authorizeByEmail (email, scopes, callback) {
    accounts.findByEmail(email, function (err, accountData) {
      if (err) return callback(err)
      access.verify(accountData.key, scopes, callback)
    })
  }

  /**
  * Update the access scopes of an account
  * @name updateScopes
  * @param {String} key – the key associated with an account
  * @param {Array} scopes – the new scopes of the account. note that this completely replaces the old scopes array
  * @param {Function} callback – callback function called with an `error` argument
  * @example
  *
  * accounts.updateScopes(key, ['example:read'], function (err) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.updateScopes = function updateScopes (key, scopes, callback) {
    access.update(key, scopes, callback)
  }

  /**
  * verify that a token is valid
  * @name verifyToken
  * @param {String} token – the JWT created when registering or logging in
  * @param {Function} callback – callback function called with `error` and `accountData` arguments
  * @example
  *
  * accounts.verifyToken(token, function (err, account) {
  *   if (err) return console.log(err)
  * })
  **/
  accounts.verifyToken = function verifyToken (token, callback) {
    if (typeof token !== 'string') return callback(new Error('encrypted token is required'))
    return jwt.verify(token, function (err, accountData) {
      if (err) return callback(err)
      callback(null, accountData, token)
    })
  }

  accounts.auth = auth
  accounts.access = access
  accounts.token = jwt
  return accounts
}

function noop (data, callback) { return callback(null, data) }
