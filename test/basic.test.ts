import manifestPlugin from '../src/index';
import fs from 'fs';
import rimraf from 'rimraf';

const OUTPUT_MANIFEST = 'test/output/manifest.json';

function buildOptions(pluginOptions = {}, overrideBuildOptions = {}) {
  const defaultBuildOptions = {
    entryPoints: ['test/input/example.js'],
    outdir: 'test/output',
    plugins: [manifestPlugin(pluginOptions)],
    bundle: true,
  }

  return {...defaultBuildOptions, ...overrideBuildOptions};
};

function metafileContents(): {[key: string]: string} {
  return JSON.parse(fs.readFileSync(OUTPUT_MANIFEST, 'utf-8'));
};

beforeEach(() => {
  return new Promise(resolve => rimraf('test/output', resolve))
});

test('it returns a valid esbuild plugin interface', () => {
  expect(manifestPlugin()).toHaveProperty('name');
  expect(manifestPlugin()).toHaveProperty('setup');
  expect(manifestPlugin().name).toBe('manifest');
});

test('it works with a require call', () => {
  const manifestPlugin = require('../lib/index');
  expect(manifestPlugin()).toHaveProperty('name');
  expect(manifestPlugin()).toHaveProperty('setup');
});

test('it should include the esbuild metafile during setup', async () => {
  const result = await require('esbuild').build(buildOptions());

  expect(result).toHaveProperty('metafile');
});

test('it should generate the manifest.json in the outdir', async () => {
  await require('esbuild').build(buildOptions());

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should generate hashed filenames by default', async () => {
  await require('esbuild').build(buildOptions({shortNames: true}));

  expect(metafileContents()['example.js']).toMatch(/^example-[^\.]+\.js$/);
});

test('it should not have an opinion on hashes when a flag is set', async () => {
  await require('esbuild').build(buildOptions({shortNames: true, hash: false}));

  expect(metafileContents()['example.js']).toBe('example.js');
});

test('it should not override the hashing format if one was supplied already', async () => {
  // our internal hash format uses a '-' instead of a '.'
  await require('esbuild').build(buildOptions({shortNames: true}, {entryNames: '[dir]/[name].[hash]'}));

  expect(metafileContents()['example.js']).toMatch(/^example\.[^\.]+\.js$/);
});

test('it should generate long names by default', async () => {
  await require('esbuild').build(buildOptions({hash: false}));

  expect(metafileContents()).toMatchObject({'test/input/example.js': 'test/output/example.js'});
});

test('it should generate short names if specified', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true}));

  expect(metafileContents()).toMatchObject({'example.js': 'example.js'});
});

test('it should generate a different filename if specified', async () => {
  await require('esbuild').build(buildOptions({filename: 'example.json'}));

  expect(fs.existsSync('test/output/example.json')).toBe(true);
  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should use the same directory as the outfile if no outdir was given', async () => {
  await require('esbuild').build(buildOptions({}, {outdir: undefined, outfile: 'test/output/out.js'}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should throw an error if building without an outdir or outfile', async () => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({}, {outdir: undefined, outfile: undefined}));
  } catch (e) {
    expect(e.message).toMatch(/outdir/);
  }
});

test('it should put the manifest file in the base directory when subdirectories are generated in the outdir', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should put the manifest file in the outdir directory when outbase is specified', async () => {
  await require('esbuild').build(buildOptions({}, {outbase: 'test', entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should throw an error when there are conflicting short names', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({shortNames: true}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']}));
  } catch (e) {
    expect(e.message).toMatch(/conflicting/);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should allow multiple entrypoints with same css', async () => {
  await require('esbuild').build(buildOptions({hash: false},{
    entryPoints: ['test/input/example-with-css/example.js', 'test/input/example-with-css/example2.js']
  }));

  expect(metafileContents()).toMatchObject({
    "test/input/example-with-css/example.js": "test/output/example.js",
    "test/input/example-with-css/example.css": "test/output/example2.css",
    "test/input/example-with-css/example2.js": "test/output/example2.js",
    "test/input/example-with-css/example2.css": "test/output/example2.css",
  });
});

test('it should allow an extensionless input', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'input'}));

  expect(metafileContents()).toMatchObject({'test/input/example': 'test/output/example.js',});
});

test('it should allow an extensionless output', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'output'}));

  expect(metafileContents()).toMatchObject({'test/input/example.js': 'test/output/example'});
});

test('it should allow an extensionless input and output by specifying true', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: true}));

  expect(metafileContents()).toMatchObject({'test/input/example': 'test/output/example'});
});

test('it should allow an extensionless input with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'input'}));

  expect(metafileContents()).toMatchObject({'example': 'example.js'});
});

test('it should allow an extensionless output with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'output'}));

  expect(metafileContents()).toMatchObject({'example.js': 'example'});
});
