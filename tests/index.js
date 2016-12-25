var test = require('tape')

var db = require('memdb')
var createAccounts = require('../index')

test('create accounts object', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  t.ok(accounts)
  t.ok(accounts.auth)
  t.ok(accounts.access)
  t.ok(accounts.token)
  t.end()
})

test('register', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)
    t.equal(typeof account.key, 'string')
    t.equal(typeof account.token, 'string')
    t.end()
  })
})

test('login', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err) {
    t.ifErr(err)
    accounts.login(creds, function (err, account) {
      t.ifErr(err)
      t.equal(typeof account.key, 'string')
      t.equal(typeof account.token, 'string')
      t.end()
    })
  })
})

test('logout', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err) {
    t.ifErr(err)
    accounts.login(creds, function (err, account) {
      t.ifErr(err)
      accounts.logout(account.token, function (err, huh) {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

test('find by email', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err) {
    t.ifErr(err)
    accounts.findByEmail(creds.email, function (err, account) {
      t.ifErr(err)
      t.equal(typeof account.key, 'string')
      t.equal(typeof account.auth, 'object')
      t.equal(typeof account.auth.basic, 'object')
      t.equal(typeof account.auth.basic.email, 'string')
      t.equal(typeof account.access, 'object')
      t.ok(Array.isArray(account.access.scopes))
      t.end()
    })
  })
})

test('change password', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)
    creds.newPassword = 'pizzayum'
    var oldToken = account.token

    // if called within 1 second the token can be the same!
    // TODO: does that matter?
    setTimeout(function () {
      accounts.updatePassword(creds, function (err, account) {
        t.ifErr(err)
        t.equal(typeof account, 'object')
        t.equal(typeof account.key, 'string')
        t.equal(typeof account.token, 'string')
        t.notEqual(oldToken, account.token)
        t.end()
      })
    }, 1000)
  })
})

test('verify token', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)

    accounts.verifyToken(account.token, function (err, tokenData, token) {
      t.ifErr(err)
      t.equal(typeof token, 'string')
      t.equal(typeof tokenData, 'object')
      t.equal(typeof tokenData.auth, 'object')
      t.equal(typeof tokenData.auth.basic, 'object')
      t.equal(typeof tokenData.auth.basic.email, 'string')
      t.equal(typeof tokenData.access, 'object')
      t.ok(Array.isArray(tokenData.access.scopes))
      t.end()
    })
  })
})

test('authorize access scopes', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass',
    scopes: ['site:read']
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)

    accounts.authorize(account.key, ['site:read'], function (err) {
      t.ifErr(err)
      accounts.authorize(account.key, ['site:nope'], function (err) {
        t.ok(err)
        t.equal(err.message, 'Access denied')
        t.end()
      })
    })
  })
})

test('authorize access scopes by email', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass',
    scopes: ['site:read']
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)

    accounts.authorizeByEmail(creds.email, ['site:read'], function (err) {
      t.ifErr(err)
      accounts.authorizeByEmail(creds.email, ['site:nope'], function (err) {
        t.ok(err)
        t.equal(err.message, 'Access denied')
        t.end()
      })
    })
  })
})

test('update access scopes', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass',
    scopes: ['site:read']
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)

    accounts.updateScopes(account.key, ['example'], function (err) {
      t.ifErr(err)
      accounts.authorize(account.key, ['example'], function (err) {
        t.ifErr(err)
        accounts.authorize(account.key, ['site:read', 'example'], function (err) {
          t.ok(err)
          t.equal(err.message, 'Access denied')
          t.end()
        })
      })
    })
  })
})

test('destroy account', function (t) {
  var accounts = createAccounts(db(), {
    secret: 'not a secret'
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)

    accounts.destroy(account.key, function (err) {
      t.ifErr(err)
      t.end()
    })
  })
})

test('hooks: beforeRegister, afterRegister, beforeDestroy', function (t) {
  t.plan(5)

  var accounts = createAccounts(db(), {
    secret: 'not a secret',
    hooks: {
      beforeRegister: function (accountData, done) {
        t.equal(typeof accountData, 'object')
        done(null, accountData)
      },
      afterRegister: function (accountEncoded, done) {
        t.equal(typeof accountEncoded, 'object')
        done(null, accountEncoded)
      },
      beforeDestroy: function (key, done) {
        t.ok(key)
        done(null, key)
      }
    }
  })

  var creds = {
    email: 'user@example.com',
    password: 'pass'
  }

  accounts.register(creds, function (err, account) {
    t.ifErr(err)
    accounts.destroy(account.key, function (err) {
      t.ifErr(err)
    })
  })
})
