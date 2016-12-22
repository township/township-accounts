var createAccounts = require('../index')
var db = require('memdb')()

var accounts = createAccounts(db, {
  secret: 'not a secret'
})

var creds = {
  email: 'user@example.com',
  password: 'pass'
}

accounts.register(creds, function (err) {
  if (err) console.log(err)
  accounts.login(creds, function (err, account) {
    if (err) console.log(err)
    console.log('account', account)
    accounts.logout(account.token, function (err) {
      if (err) console.log(err)
    })
  })
})
