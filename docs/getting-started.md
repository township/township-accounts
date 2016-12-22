# Getting started with township-accounts

### Create the `accounts` object by calling the `townshipAccounts` constructor:

```js
var townshipAccounts = require('township-accounts')
var level = require('level')
var db = level('db')

var accounts = townshipAccounts(db, {
  secret: 'not very secret'
})
```

## Create an account with the `register` method:

```js
var creds = {
  email: 'hi@example.com',
  password: 'weee'
}

accounts.register(creds, function (err, account) {
  console.log(err, account)
})
```

## Log in with the `login` method:

```js
var creds = {
  email: 'hi@example.com',
  password: 'weee'
}

accounts.login(creds, function (err, account) {
  console.log(err, account)
})
```

## Log out with the `logout` method:

```js
accounts.logout(accountKey, function (err, account) {
  console.log(err, account)
})
```

See more in the [API documentation](api.md)
