var test = require('tape')

var db = require('memdb')
var createAccounts = require('../index')

test('create accounts object', function (t) {
  var accounts = createAccounts(db(), {
    name: 'example'
  })

  t.ok(accounts)
  t.ok(accounts.auth)
  t.ok(accounts.access)
  t.ok(accounts.token)
  t.end()
})
