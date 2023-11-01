# esbuild-plugin-manifest

![Release Version](https://img.shields.io/github/v/release/jfortunato/esbuild-plugin-manifest)
![Node.js CI](https://github.com/jfortunato/esbuild-plugin-manifest/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/jfortunato/esbuild-plugin-manifest/graph/badge.svg?token=TWEQVWQ09G)](https://codecov.io/gh/jfortunato/esbuild-plugin-manifest)

This plugin will generate a manifest.json file, mapping original asset names to their corresponding output name.

## Install

```bash
npm install --save-dev esbuild esbuild-plugin-manifest
```

## Usage

Create file `build.js`:

```js
const esbuild = require('esbuild');
const manifestPlugin = require('esbuild-plugin-manifest')

esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outdir: 'output/',
    plugins: [manifestPlugin()],
}).catch((e) => console.error(e.message))
```

This will generate a `manifest.json` in the output directory with a mapping of all the unhashed filenames to their corresponding hashed output filename:

```json
{
  "output/index.js": "output/index-4QTUNIID.js"
}
```

## Options

### `options.hash`

Type: `Boolean`

Default: true

By default we assume that you want to hash the output files. We use `[dir]/[name]-[hash]` as the default hash format. You can disable hashing by setting this to false or you can set your own hash format by directly using esbuild's `entryNames` option.

### `options.shortNames`

Type: `Boolean` | 'input' | 'output'

Default: false

By default we will use the full input and output paths `{"output/index.js":"output/index-4QTUNIID.js"}`, but when this option is enabled it will use the basename of the files `{"index.js":"index-4QTUNIID.js"}`

### `options.extensionless`

Type: `Boolean` | `'input'` | `'output'`

Default: false

We'll keep all file extensions by default, but you can specify `true` to remove them from both or one of `'input'` or `'output'` to only remove them from the input or output respectively. Eg: specifying `manifestPlugin({ extensionless: 'input' })` will result in `{"output/index":"output/index-4QTUNIID.js"}`

### `options.filename`

Type: `String`

Default: `manifest.json`

The name of the generated manifest file in the output directory.

### `options.generate`

Type: `Function`

Default: `undefined`

A custom Function to create the manifest. The passed function should match the signature of `(entries: {[key: string]: string}) => Object`; and can return anything as long as it's serialisable by `JSON.stringify`.

### `options.filter`

Type: `Function`

Default: `undefined`

Allows filtering the files which make up the manifest. The passed function should match the signature of `(filename: string) => boolean`. Return `true` to keep the file, `false` to remove the file.

### `options.useEntrypointKeys`

Type: `Boolean`

Default: `false`

By default, we use the same extension of the output file as the keys of the manifest key entry. Use this option if you'd rather use the input file (entrypoint) as the manifest key instead.

### `options.append`

Type: `Boolean`

Default: `false`

By default, we will overwrite the manifest file if it already exists. This option will append to the existing manifest file instead and only overwrite the entries that have changed.

## Advanced Usage Examples

### Typescript Entrypoint

```js
// build.js
const esbuild = require('esbuild');
const manifestPlugin = require('esbuild-plugin-manifest')

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'output/',
  plugins: [manifestPlugin()],
}).catch((e) => console.error(e.message))
```

```json5
// manifest.json
{
  "output/index.js": "output/index-4QTUNIID.js"
}
```

### Entrypoint Keys (.ts file example)

```js
// build.js
const esbuild = require('esbuild');
const manifestPlugin = require('esbuild-plugin-manifest')

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'output/',
  plugins: [manifestPlugin({useEntrypointKeys: true})],
}).catch((e) => console.error(e.message))
```

```json5
// manifest.json
{
  "src/index.ts": "output/index-4QTUNIID.js"
}
```

### Multiple Formats

To generate multiple files from the same entrypoint with esbuild, you need to run it multiple times. Utilize esbuilds [`outExtension`](https://esbuild.github.io/api/#out-extension) option along with our [`append`](https://github.com/jfortunato/esbuild-plugin-manifest#optionsappend) option to generate multiple files from the same entrypoint.

```js
// build.js
import * as esbuild from 'esbuild'
import manifestPlugin from 'esbuild-plugin-manifest'

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outdir: 'output/',
  format: 'cjs',
  plugins: [manifestPlugin()],
}).catch((e) => console.error(e.message))

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outdir: 'output/',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  plugins: [manifestPlugin({ append: true })],
}).catch((e) => console.error(e.message))

```

```json5
// manifest.json
{
  "output/index.js": "output/index-4QTUNIID.js",
  "output/index.mjs": "output/index-5RUVOJJE.mjs"
}
```
