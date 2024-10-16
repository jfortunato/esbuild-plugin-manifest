import manifestPlugin from '../src/index';
import fs from 'fs';
import path from 'path';
import util from 'util';
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
  const manifestPlugin = require('../src/index');
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

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js'});
});

test('it should generate short names if specified', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true}));

  expect(metafileContents()).toEqual({'example.js': 'example.js'});
});

test('it should allow a short name for the input only', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: 'input'}));

  expect(metafileContents()).toEqual({'example.js': 'test/output/example.js'});
});

test('it should allow a short name for the output only', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: 'output'}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'example.js'});
});

test('it should throw an error when there are conflicting short names', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({shortNames: true}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']}));
  } catch (e: any) {
    expect(e.message).toMatch(/conflicting/);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should not throw an error if the short name has the same extension but a different basename', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/example.js']}));

  expect(metafileContents()).toEqual({'index.js': 'index.js', 'example.js': 'example.js'});
});

test('it should not throw an error if the entrypoints have the same name, different extensions, and the useEntrypointKeys option is used', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, useEntrypointKeys: true}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.ts']}));

  expect(metafileContents()).toEqual({'index.js': 'index.js', 'index.ts': 'index.js'});
});

test('it should throw an error if there are conflicting outputs when the shortNames option is used', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({hash: false, shortNames: 'output'}, {entryPoints: ['test/input/pages/about/index.js', 'test/input/pages/about/index.ts']}));
  } catch (e: any) {
    // esbuild itself should throw an error
    expect(e.message).toMatch(/share the same path/);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should throw an error if the shortname has a different extension but extensionless was also specified', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: true}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.ts']}));
  } catch (e: any) {
    expect(e.message).toMatch(/conflicting/);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
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
  } catch (e: any) {
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

test('it should allow multiple entrypoints with same css', async () => {
  await require('esbuild').build(buildOptions({hash: false},{
    entryPoints: ['test/input/example-with-css/example.js', 'test/input/example-with-css/example2.js']
  }));

  expect(metafileContents()).toEqual({
    "test/output/example.js": "test/output/example.js",
    "test/output/example.css": "test/output/example.css",
    "test/output/example2.css": "test/output/example2.css",
    "test/output/example2.js": "test/output/example2.js",
  });
});

test('it should include an imported css file that is not an explicit entrypoint', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example.js']}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js', 'test/output/example.css': 'test/output/example.css'});
});

test('it should map a sibling css file when no hash is used', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example.js']}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js', 'test/output/example.css': 'test/output/example.css'});
})

test('it should map a sibling css file when the standard hash is used', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js']}));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toMatch(/test\/output\/example-[^\.]+\.js/);
  expect(contents['test/output/example.css']).toMatch(/test\/output\/example-[^\.]+\.css/);
})

test('it should map a sibling css file when a different hash is used', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js'], entryNames: '[dir]/[name].[hash]'}));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toMatch(/test\/output\/example\.[^\.]+\.js/);
  expect(contents['test/output/example.css']).toMatch(/test\/output\/example\.[^\.]+\.css/);
})

test('it should map a sibling css file when the hash runs up directly against the filename', async () => {
  // notice there is no separation between name and hash
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js'], entryNames: '[dir]/[name][hash]'}));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toMatch(/test\/output\/example[^\.]+\.js/);
  expect(contents['test/output/example.css']).toMatch(/test\/output\/example[^\.]+\.css/);
});

test('it should map a sibling css file when the hash comes before a suffix', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js'], entryNames: '[dir]/[name]-[hash]-FOO'}));

  const contents = metafileContents();

  expect(contents['test/output/example-FOO.js']).toMatch(/test\/output\/example-[^\.]+-FOO\.js/);
  expect(contents['test/output/example-FOO.css']).toMatch(/test\/output\/example-[^\.]+-FOO\.css/);
});

test('it should map a sibling css file when the hash runs up directly against a suffix with capital letters', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js'], entryNames: '[dir]/[name]-[hash]FOO'}));

  const contents = metafileContents();

  expect(contents['test/output/exampleFOO.js']).toMatch(/test\/output\/example-[^\.]+FOO\.js/);
  expect(contents['test/output/exampleFOO.css']).toMatch(/test\/output\/example-[^\.]+FOO\.css/);
});

// TODO handle this edge case
// test('it should map a sibling css file when the hash runs up directly against a prefix with capital letters', async () => {
//   await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js'], entryNames: '[dir]/[name]FOO[hash]'}));
//
//   const contents = metafileContents();
//
//   expect(contents['test/input/example-with-css/example.js']).toMatch(/test\/output\/exampleFOO[^\.]+\.js/);
//   expect(contents['test/input/example-with-css/example.css']).toMatch(/test\/output\/exampleFOO[^\.]+\.css/);
// });

test('it should throw an error when a css sibling conflicts with a css entrypoint', async () => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js', 'test/input/example-with-css/example.css']}));
  } catch (e: any) {
    expect(e.message).toMatch(/conflicting/);
  }
});

test('it should not attempt to find a sibling for a css entrypoint ', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/global.css']}));

  const contents = metafileContents();

  expect(contents['test/output/global.css']).toMatch(/test\/output\/global-[^\.]+\.css/);
});

test('it should map typescript files', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example.ts']}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js'});
});

test('it should map typescript files that import css', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example-typescript.ts']}));

  expect(metafileContents()).toEqual({'test/output/example-typescript.js': 'test/output/example-typescript.js', 'test/output/example-typescript.css': 'test/output/example-typescript.css'});
});

test('it should include an imported image file that is not an explicit entrypoint', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-image/example.js'], loader: {'.png': 'file'}}));

  const contents = metafileContents();
  expect(contents['test/output/example.js']).toMatch(/test\/output\/example-[^\.]+\.js/);
  expect(contents['test/output/example.png']).toMatch(/test\/output\/example-[^\.]+\.png/);
});

test('it should include an imported image file that is not an explicit entrypoint (hash=false)', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-image/example.js'], loader: {'.png': 'file'}}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js', 'test/output/example.png': 'test/output/example.png'});
});

test('it should include assets placed inside their own directory within the outdir', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-image/example.js'], loader: {'.png': 'file'}, assetNames: 'assets/[name]-[hash]'}));

  const contents = metafileContents();
  expect(contents['test/output/example.js']).toMatch(/test\/output\/example-[^\.]+\.js/);
  expect(contents['test/output/assets/example.png']).toMatch(/test\/output\/assets\/example-[^\.]+\.png/);
});

test('it should throw an error if the extensionless option is used with bundled css', async () => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({hash: false, extensionless: 'input'}, {entryPoints: ['test/input/example-with-css/example.js']}));
  } catch (e: any) {
    expect(e.message).toMatch(/conflicting manifest key.+example\.js.+example\.css/);
  }
});

test('it should allow an extensionless input', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'input'}));

  expect(metafileContents()).toEqual({'test/output/example': 'test/output/example.js'});
});

test('it should allow an extensionless output', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'output'}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example'});
});

test('it should allow an extensionless input and output by specifying true', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: true}));

  expect(metafileContents()).toEqual({'test/output/example': 'test/output/example'});
});

test('it should allow an extensionless input with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'input'}));

  expect(metafileContents()).toEqual({'example': 'example.js'});
});

test('it should allow an extensionless output with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'output'}));

  expect(metafileContents()).toEqual({'example.js': 'example'});
});

test.each([
  {
    name: 'extensionless input with multiple extensions (via outExtension)',
    extensionless: 'input',
    buildOptions: { outExtension: {'.js': '.min.js'} },
    expected: {'test/output/example': 'test/output/example.min.js'},
  },
  {
    name: 'extensionless output with multiple extensions (via outExtension)',
    extensionless: 'output',
    buildOptions: { outExtension: {'.js': '.min.js'} },
    expected: {'test/output/example.min.js': 'test/output/example'},
  },
  {
    name: 'extensionless input should retain .map extension for sourcemaps',
    extensionless: 'input',
    buildOptions: { sourcemap: true },
    expected: {'test/output/example.map': 'test/output/example.js.map', 'test/output/example': 'test/output/example.js'},
  },
  {
    name: 'extensionless output should retain .map extension for sourcemaps',
    extensionless: 'output',
    buildOptions: { sourcemap: true },
    expected: {'test/output/example.js.map': 'test/output/example.map', 'test/output/example.js': 'test/output/example'},
  },
])('it should allow the extensionless option on a file with multiple extensions', async (options) => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: options.extensionless}, options.buildOptions));

  expect(metafileContents()).toEqual(options.expected);
});

test('it should not throw an error with esbuild write=false option', async () => {
  await require('esbuild').build(buildOptions({}, {write: false}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
})

test('it should include the manifest file as part of the build result output files with the esbuild write=false option', async () => {
  const result = await require('esbuild').build(buildOptions({hash: false}, {write: false}));

  const expectedText = `{\n  "test/output/example.js": "test/output/example.js"\n}`;

  const expected = {
    path: path.resolve(OUTPUT_MANIFEST),
    contents: new util.TextEncoder().encode(expectedText),
    hash: "61b660e9d4084e594c725b307bf4ed395880342738e9b78c6f66f44b1a08e5cb",
    text: expectedText,
  };

  expect(result.outputFiles).toContainEqual(expected);
});

test('it should modify result using generate function', async () => {
  await require('esbuild').build(buildOptions({generate: (entries: {[key: string]: string}) => {return {files: entries}}, hash: false}));

  expect(metafileContents()).toEqual({"files":{"test/output/example.js": "test/output/example.js"}});
})

test('it should only generate the manifest when the build result contains no errors', async () => {
  try {
    await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-error.js']}));
  } catch (e: any) {
    // We should expect only 1 BuildFailure error from the source file, we don't want our plugin to throw its own error
    expect(e.errors.length).toBe(1);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should obtain a lock when writing the manifest file so its not corrupted when running in parallel', async () => {
  // Increase the chances of hitting the fail condition (pre-fix) by running the test multiple times
  const TIMES_TO_RUN = 10;

  for (let i = 0; i < TIMES_TO_RUN; i++) {
    const esbuild = require('esbuild');

    await Promise.all([
      esbuild.build(buildOptions({}, {format: 'iife'})),
      esbuild.build(buildOptions({}, {format: 'esm', outExtension: {'.js': '.mjs'}})),
    ]);

    expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
    // When a race condition occurs, the manifest file will not be valid JSON. Usually what happens is
    // it will end with double braces, like this: "}}"
    // The issue only happens about 1/3 of the time (before implementing a fix)
    expect(() => JSON.parse(fs.readFileSync(OUTPUT_MANIFEST, 'utf-8'))).not.toThrow();
  }
});

test('it should use the same extension as the output when it is changed via the esbuild outExtension option', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {outExtension: {'.js': '.mjs'}}));

  expect(metafileContents()).toEqual({'test/output/example.mjs': 'test/output/example.mjs'});
});

test('it should use the same extension as the entry with useEntrypointKeys option', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true}, {outExtension: {'.js': '.mjs'}}));

  expect(metafileContents()).toEqual({'test/input/example.js': 'test/output/example.mjs'});
});

test('it should use the same extension as the entry with useEntrypointKeys option (typescript)', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true}, {entryPoints: ['test/input/example.ts']}));

  expect(metafileContents()).toEqual({'test/input/example.ts': 'test/output/example.js'});
});

test('it should use the same extension as the entry with useEntrypointKeys option when using outfile instead of outdir', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true}, {outdir: undefined, outfile: 'test/output/out.mjs'}));

  expect(metafileContents()).toEqual({'test/input/example.js': 'test/output/out.mjs'});
});

test.each(['input', true])('it should not throw an error when using the useEntrypointKeys option with a compatible extensionless option', async (extensionlessOption) => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true, extensionless: extensionlessOption}));
  } catch (e: any) {
    // Just check that the error message mentions both options
    expect(e.message).toMatch(/useEntrypointKeys.+extensionless/);
  }
});

test.each(['output', false, undefined])('it should not throw an error when using the useEntrypointKeys option with a compatible extensionless option', async (extensionlessOption) => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true, extensionless: extensionlessOption}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it is able to use extensionless=output along with useEntrypointKeys', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true, extensionless: 'output'}, {outExtension: {'.js': '.mjs'}}));

  expect(metafileContents()).toEqual({'test/input/example.js': 'test/output/example'});
})

test('it should retain a previous key with append=true option', async () => {
  await require('esbuild').build(buildOptions({hash: false}));
  await require('esbuild').build(buildOptions({hash: false, append: true}, {entryPoints: ['test/input/pages/home/index.js']}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js', 'test/output/index.js': 'test/output/index.js'});
});

test('it should overwrite a previous key with append=true option if its been updated', async () => {
  // The first build will generate a manifest with a hash
  await require('esbuild').build(buildOptions({hash: true}));
  // The second build will generate a manifest without a hash
  await require('esbuild').build(buildOptions({hash: false, append: true}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js'});
});

test('it should not throw an error if there is no preexisting file with append=true option', async () => {
  await require('esbuild').build(buildOptions({hash: false, append: true}));

  expect(metafileContents()).toEqual({'test/output/example.js': 'test/output/example.js'});
});

test('it supports multiple output formats by using append=true and running esbuild multiple times with a different outExtension', async () => {
  await require('esbuild').build(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.mjs'}}));
  await require('esbuild').build(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.cjs'}}));

  expect(metafileContents()).toEqual({'test/output/example.mjs': 'test/output/example.mjs', 'test/output/example.cjs': 'test/output/example.cjs'});
});

test('it should keep the file when filter function returns true', async () => {
  await require('esbuild').build(buildOptions({filter: (filename: string) => filename.match(/example/), hash: false}));

  expect(metafileContents()).toEqual({"test/output/example.js": "test/output/example.js"});
});

test('it should remove the file when filter function returns false', async () => {
  await require('esbuild').build(buildOptions({filter: (filename: string) => filename.match(/notFound/), hash: false}));

  expect(metafileContents()).toEqual({});
});

test('it should use the hashed filename of chunks as keys when splitting is enabled', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/splitting/index.js', 'test/input/splitting/home.js', 'test/input/splitting/about.js'],
    splitting: true,
    format: 'esm',
  }));

  expect(metafileContents()['test/output/chunk-YJHBKB32.js']).toEqual('test/output/chunk-YJHBKB32.js');
  expect(metafileContents()['test/output/chunk-CGERAYKX.js']).toEqual('test/output/chunk-CGERAYKX.js');
});

test('it should use the hashed filename of chunks sourcemaps as keys when splitting is enabled', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/splitting/index.js', 'test/input/splitting/home.js', 'test/input/splitting/about.js'],
    splitting: true,
    sourcemap: true,
    format: 'esm',
  }));

  expect(metafileContents()['test/output/chunk-VKLVG2YY.js.map']).toEqual('test/output/chunk-VKLVG2YY.js.map');
  expect(metafileContents()['test/output/chunk-32OWP2O4.js.map']).toEqual('test/output/chunk-32OWP2O4.js.map');
});

test('it supports multiple output formats by using append=true while esbuild is watching the files', async () => {
  const ctx1 = await require('esbuild').context(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.mjs'}}));
  const ctx2 = await require('esbuild').context(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.cjs'}}));

  await ctx1.watch();
  await ctx2.watch();

  await ctx1.dispose();
  await ctx2.dispose();

  expect(metafileContents()).toEqual({'test/output/example.mjs': 'test/output/example.mjs', 'test/output/example.cjs': 'test/output/example.cjs'});
});
