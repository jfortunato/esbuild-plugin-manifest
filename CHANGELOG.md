# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Fixed
- The previous method used for finding CSS sibling files would sometimes choose the wrong output. That has been fixed to always choose the correct js/css pair.

## [v0.3.0]
### Changed
- Allow the `shortNames` option to specify the input/output or both.
### Added
- CSS 'sibling' files that are imported from js will be included in the manifest.

## [v0.2.1] - 2021-05-10
### Fixed
- Fix broken CI build process

## [v0.2.0] - 2021-05-10
### Added
- New option `extensionless` to drop the extension from the input/output or both.

## [v0.1.0] - 2021-05-07
- Initial release
