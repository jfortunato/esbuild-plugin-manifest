## [0.7.0](https://github.com/jfortunato/esbuild-plugin-manifest/compare/v0.6.0...v0.7.0) (2023-10-26)


### Features

* Add "append" option to not overwrite existing manifest ([90be58a](https://github.com/jfortunato/esbuild-plugin-manifest/commit/90be58a0880864f5afa6628682f28b413c19944a))
* Enable manifest keys to use the same extension as it's outfile ([e0d54d4](https://github.com/jfortunato/esbuild-plugin-manifest/commit/e0d54d4151e2829eb18b4506e876d24fb2075704))


### Bug Fixes

* Prevent multiple parallel builds from corrupting manifest file ([e0a713f](https://github.com/jfortunato/esbuild-plugin-manifest/commit/e0a713fdfa0f9d17259501427cb9765e7c2ad4a1))

## [v0.6.0]
### Fixed
- Don't throw our own errors when the build result contains other errors.

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
