## [1.0.0](https://github.com/jfortunato/esbuild-plugin-manifest/compare/v0.7.0...v1.0.0) (2023-10-31)


### ⚠ BREAKING CHANGES

* Base manifest keys off output directory. Previous versions would use the input (entrypoint) as the manifest key. To retain that same behavior, a new `useEntrypointKeys` option has been added.

### Features

* Add filter option ([4a56e61](https://github.com/jfortunato/esbuild-plugin-manifest/commit/4a56e6101c2aef4a6d787175ff0009695bb15572))
* Base manifest keys off output directory ([1bbbc59](https://github.com/jfortunato/esbuild-plugin-manifest/commit/1bbbc59d57e6341784b4c702675aeb7f6e8ba0db))
* Include all outputs in manifest ([2c22050](https://github.com/jfortunato/esbuild-plugin-manifest/commit/2c22050df5b50a8e9b232e1e0119d20b4fc5c347))


### Bug Fixes

* Key for sibling css file in root directory no longer starts with slash ([7d0245a](https://github.com/jfortunato/esbuild-plugin-manifest/commit/7d0245affa2f1ad669332fc1d7d97bd5536f86f8))

## [1.0.3](https://github.com/jfortunato/esbuild-plugin-manifest/compare/v1.0.2...v1.0.3) (2024-02-07)


### Bug Fixes

* Don't throw a conflict error when code splitting is used ([daf1bf6](https://github.com/jfortunato/esbuild-plugin-manifest/commit/daf1bf6d16448bc5f0c2bcd65354f5878cfa1cb1))

## [1.0.2](https://github.com/jfortunato/esbuild-plugin-manifest/compare/v1.0.1...v1.0.2) (2023-12-13)


### Bug Fixes

* Retain .map extension for sourcemaps with extensionless option. ([e9ab4cb](https://github.com/jfortunato/esbuild-plugin-manifest/commit/e9ab4cb223ead91be8eaf7dfd127b5e0877512f0))

## [1.0.1](https://github.com/jfortunato/esbuild-plugin-manifest/compare/v1.0.0...v1.0.1) (2023-12-06)


### Bug Fixes

* The `extensionless` option now accounts for filenames with multiple extensions ([f88cfd7](https://github.com/jfortunato/esbuild-plugin-manifest/commit/f88cfd7e54c91af22a9701f14291bbd0470babd7))

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
