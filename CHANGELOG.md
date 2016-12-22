# township-accounts change log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

* ???

## 4.0.0

### Added
* API docs
* basic usage example
* tests
* `authorize`, `authorizeByEmail`, `updateScopes` methods

### Changed
* `resetPassword` method became `updatePassword`
* `verifyToken` method now takes a JWT as first argument instead of a request object (see the main [township repo for dealing with request objects](https://github.com/township/township))

### Removed
* removed methods related to request & response handling (see the main [township repo for a replacement](https://github.com/township/township))

### Fixed
* Hooks now work as expected
