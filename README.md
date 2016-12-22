# township-accounts

Node.js library for managing user accounts.

[![npm][npm-image]][npm-url]
[![travis][travis-image]][travis-url]
[![standard][standard-image]][standard-url]
[![conduct][conduct]][conduct-url]

[npm-image]: https://img.shields.io/npm/v/township-accounts.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/township-accounts
[travis-image]: https://img.shields.io/travis/township/township-accounts.svg?style=flat-square
[travis-url]: https://travis-ci.org/township/township-accounts
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard
[conduct]: https://img.shields.io/badge/code%20of%20conduct-contributor%20covenant-green.svg?style=flat-square
[conduct-url]: CONDUCT.md

## About

township-accounts is a high-level module based on [township-auth](https://github.com/township/township-auth), which manages authentication credentials, [township-access](https://github.com/township/township-access), which manages authorization via access scopes, and [township-token](https://github.com/township/township-token), which manages JWT tokens.

## Install

```sh
npm install --save township-accounts
```

## Usage

### Create the `accounts` object by calling the `townshipAccounts` constructor:

```js
var townshipAccounts = require('township-accounts')
var level = require('level')
var db = level('db')

var accounts = townshipAccounts(db, {
  secret: 'not very secret'
})
```

### Create an account with the `register` method:

```js
var creds = {
  email: 'hi@example.com',
  password: 'weee'
}

accounts.register(creds, function (err, account) {
  console.log(err, account)
})
```

### Log in with the `login` method:

```js
var creds = {
  email: 'hi@example.com',
  password: 'weee'
}

accounts.login(creds, function (err, account) {
  console.log(err, account)
})
```

### Log out with the `logout` method:

```js
accounts.logout(accountKey, function (err, account) {
  console.log(err, account)
})
```

See more in the [API documentation](docs/api.md)

## Documentation
- [Getting started](docs/getting-started.md)
- [API](docs/api.md)
- [Tests](tests/)

### Examples
- [Basic example](examples/basic.js)

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## Conduct

It is important that this project contributes to a friendly, safe, and welcoming environment for all. Read this project's [code of conduct](CONDUCT.md)

## Changelog

Read about the changes to this project in [CHANGELOG.md](CHANGELOG.md). The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## Contact

- **issues** – Please open issues in the [issues queue](https://github.com/township/township-accounts/issues)
- **twitter** – Have a question? [@sethdvincent](https://twitter.com/sethdvincent)
- **email** – Need in-depth support via paid contract? Send an email to sethvincent@gmail.com

## License

[ISC](LICENSE.md)
