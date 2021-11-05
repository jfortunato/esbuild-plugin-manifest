# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- New option `filter` to allow filtering the files which make up the manifest.

## [v0.5.0]
### Added
- New option `generate` to allow modifying the manifest result.

## [v0.4.6]
### Fixed
- Broken tests on Node v10 due to using global `TextEncoder` instead of `util.TextEncoder`

## [v0.4.5]
### Fixed
- An error would be thrown when using the esbuild `watch=false` option. Now the manifest file is included with esbuild's `outputFiles` and no error is thrown.

## [v0.4.4]
### Fixed
- Typescript types are now included with the npm package.

## [v0.4.3]
### Changed
- Relax peerDependency on esbuild to everything under v1.0

## [v0.4.2]
### Fixed
- Fix error when typescript entrypoints import css.

## [v0.4.1]
### Fixed
- Only JS entrypoints will check for a sibling CSS file.

## [v0.4.0]
### Fixed
- The previous method used for finding CSS sibling files would sometimes choose the wrong output. That has been fixed to always choose the correct js/css pair.
- Any conflicting manifest input key at all will throw an error.

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
