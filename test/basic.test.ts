import manifestPlugin from '../src/index';
import fs from 'fs';
import path from 'path';
// import util from 'util';
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
}

function metafileContents(): { [key: string]: Map<string, string> } {
  return JSON.parse(fs.readFileSync(OUTPUT_MANIFEST, 'utf-8'));
}

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
  await require('esbuild').build(buildOptions({}));

  expect(metafileContents()['test/output/example.js']).toHaveProperty('file', 'test/output/example-TM2TU5PS.js');
});

test('it should not have an opinion on hashes when a flag is set', async () => {
  await require('esbuild').build(buildOptions({hash: false}));

  expect(metafileContents()['test/output/example.js']).toHaveProperty('file', 'test/output/example.js');
});

test('it should not override the hashing format if one was supplied already', async () => {
  // our internal hash format uses a '-' instead of a '.'
  await require('esbuild').build(buildOptions({}, {entryNames: '[dir]/[name].[hash]'}));

  expect(metafileContents()['test/output/example.js']).toHaveProperty('file', 'test/output/example.WQZWGPFO.js');
});

test('it should generate long names by default', async () => {
  await require('esbuild').build(buildOptions({hash: false}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    }
  });
});

test('it should generate short names if specified', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true}));

  expect(metafileContents()).toEqual({
    "example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
});

test('it should allow a short name for the input only', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: 'input'}));

  expect(metafileContents()).toEqual({
    "example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    }
  });
});

test('it should allow a short name for the output only', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: 'output'}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
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

test('it should not throw an error if the short name has the same extension but a different basename', async () => {
  await require('esbuild').build(buildOptions({
    hash: false,
    shortNames: true
  }, {entryPoints: ['test/input/pages/home/index.js', 'test/input/example.js']}));

  expect(metafileContents()).toEqual({
    "example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    },
    "index.js": {
      "etag": "4694eb03ef8c45e99982c1498c14b5d7",
      "file": "index.js",
      "integrity": "bxjaJQy+wK5iAuw4M2hS7WVPApv9sSfXyDSrlxL6ZcK2Io774FFqHhRP1HRSvy0R",
      "source": "test/output/pages/home/index.js"
    }
  });
});

test('it should not throw an error if the entrypoints have the same name, different extensions, and the useEntrypointKeys option is used', async () => {
  await require('esbuild').build(buildOptions({
    hash: false,
    shortNames: true,
    useEntrypointKeys: true
  }, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.ts']}));

  expect(metafileContents()).toEqual({
    "index.js": {
      "etag": "4694eb03ef8c45e99982c1498c14b5d7",
      "file": "index.js",
      "integrity": "bxjaJQy+wK5iAuw4M2hS7WVPApv9sSfXyDSrlxL6ZcK2Io774FFqHhRP1HRSvy0R",
      "source": "test/input/pages/home/index.js"
    },
    "index.ts": {
      "etag": "13a53b958519519ded3a10eb701db4be",
      "file": "index.js",
      "integrity": "rCk2iikSVs/QfYt1NljFRP3vJBg/wlwOK1jWzb943CGfmzTAT91jqEPib+N7s9KN",
      "source": "test/input/pages/about/index.ts"
    }
  });
});

test('it should throw an error if there are conflicting outputs when the shortNames option is used', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({
      hash: false,
      shortNames: 'output'
    }, {entryPoints: ['test/input/pages/about/index.js', 'test/input/pages/about/index.ts']}));
  } catch (e) {
    // esbuild itself should throw an error
    expect(e.message).toMatch(/share the same path/);
  }

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
});

test('it should throw an error if the shortname has a different extension but extensionless was also specified', async () => {
  expect.assertions(2);

  try {
    await require('esbuild').build(buildOptions({
      hash: false,
      shortNames: true,
      extensionless: true
    }, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.ts']}));
  } catch (e) {
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
  } catch (e) {
    expect(e.message).toMatch(/outdir/);
  }
});

test('it should put the manifest file in the base directory when subdirectories are generated in the outdir', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should put the manifest file in the outdir directory when outbase is specified', async () => {
  await require('esbuild').build(buildOptions({}, {
    outbase: 'test',
    entryPoints: ['test/input/pages/home/index.js', 'test/input/pages/about/index.js']
  }));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it should allow multiple entrypoints with same css', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {
    entryPoints: ['test/input/example-with-css/example.js', 'test/input/example-with-css/example2.js']
  }));

  expect(metafileContents()).toEqual({
    "test/output/example.css": {
      "etag": "d861a27cb8083dd5a254c18fb47036e1",
      "file": "test/output/example.css",
      "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
      "source": "test/output/example.css",
    },
    "test/output/example.js": {
      "etag": "c702abdf049a2f21bc15ad6b7829e98a",
      "file": "test/output/example.js",
      "integrity": "KCCZhbucz5r84a/4NBJ73lBIeOoglm70UBvXSWXEZgu3vUvoX/6mCeJOoLRtDaTv",
      "source": "test/output/example.js",
    },
    "test/output/example2.css": {
      "etag": "d861a27cb8083dd5a254c18fb47036e1",
      "file": "test/output/example2.css",
      "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
      "source": "test/output/example2.css",
    },
    "test/output/example2.js": {
      "etag": "6996645e5faeb5f6f9411bceb729f0d0",
      "file": "test/output/example2.js",
      "integrity": "Jzra72/2c7bse1t3ubEL+TE+9jkiw4tdmKn8jtTi8XljfHf/pjzycKv4195VE2za",
      "source": "test/output/example2.js",
    },
  });
});

test('it should include an imported css file that is not an explicit entrypoint', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example.js']}));

  expect(metafileContents()).toEqual({
    "test/output/example.css": {
      "etag": "d861a27cb8083dd5a254c18fb47036e1",
      "file": "test/output/example.css",
      "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
      "source": "test/output/example.css",
    },
    "test/output/example.js": {
      "etag": "c702abdf049a2f21bc15ad6b7829e98a",
      "file": "test/output/example.js",
      "integrity": "KCCZhbucz5r84a/4NBJ73lBIeOoglm70UBvXSWXEZgu3vUvoX/6mCeJOoLRtDaTv",
      "source": "test/output/example.js",
    },
  });
});

test('it should map a sibling css file when no hash is used', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example.js']}));

  expect(metafileContents()).toEqual({
    "test/output/example.css": {
      "etag": "d861a27cb8083dd5a254c18fb47036e1",
      "file": "test/output/example.css",
      "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
      "source": "test/output/example.css",
    },
    "test/output/example.js": {
      "etag": "c702abdf049a2f21bc15ad6b7829e98a",
      "file": "test/output/example.js",
      "integrity": "KCCZhbucz5r84a/4NBJ73lBIeOoglm70UBvXSWXEZgu3vUvoX/6mCeJOoLRtDaTv",
      "source": "test/output/example.js",
    },
  });
})

test('it should map a sibling css file when the standard hash is used', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/example.js']}));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toHaveProperty('file', 'test/output/example-XTLCBWFF.js');
  expect(contents['test/output/example.css']).toHaveProperty('file', 'test/output/example-GQI5TWWV.css');
})

test('it should map a sibling css file when a different hash is used', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-css/example.js'],
    entryNames: '[dir]/[name].[hash]'
  }));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toHaveProperty('file', 'test/output/example.WD5UUBCK.js');
  expect(contents['test/output/example.css']).toHaveProperty('file', 'test/output/example.3AFJQGEY.css');
})

test('it should map a sibling css file when the hash runs up directly against the filename', async () => {
  // notice there is no separation between name and hash
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-css/example.js'],
    entryNames: '[dir]/[name][hash]'
  }));

  const contents = metafileContents();

  expect(contents['test/output/example.js']).toHaveProperty('file', 'test/output/exampleRMF27ZCU.js');
  expect(contents['test/output/example.css']).toHaveProperty('file', 'test/output/examplePEWCBBN7.css');
});

test('it should map a sibling css file when the hash comes before a suffix', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-css/example.js'],
    entryNames: '[dir]/[name]-[hash]-FOO'
  }));

  const contents = metafileContents();

  expect(contents['test/output/example-FOO.js']).toEqual({
    "etag": "c702abdf049a2f21bc15ad6b7829e98a",
    "file": "test/output/example-UDCOIXTA-FOO.js",
    "integrity": "KCCZhbucz5r84a/4NBJ73lBIeOoglm70UBvXSWXEZgu3vUvoX/6mCeJOoLRtDaTv",
    "source": "test/output/example-FOO.js"
  });
  expect(contents['test/output/example-FOO.css']).toEqual({
    "etag": "d861a27cb8083dd5a254c18fb47036e1",
    "file": "test/output/example-ZNREH66Y-FOO.css",
    "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
    "source": "test/output/example-FOO.css"
  });
});

test('it should map a sibling css file when the hash runs up directly against a suffix with capital letters', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-css/example.js'],
    entryNames: '[dir]/[name]-[hash]FOO'
  }));

  const contents = metafileContents();

  expect(contents['test/output/exampleFOO.js']).toEqual({
    "etag": "c702abdf049a2f21bc15ad6b7829e98a",
    "file": "test/output/example-WYQNDWQXFOO.js",
    "integrity": "KCCZhbucz5r84a/4NBJ73lBIeOoglm70UBvXSWXEZgu3vUvoX/6mCeJOoLRtDaTv",
    "source": "test/output/exampleFOO.js"
  });
  expect(contents['test/output/exampleFOO.css']).toEqual({
    "etag": "d861a27cb8083dd5a254c18fb47036e1",
    "file": "test/output/example-UWCVZI52FOO.css",
    "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
    "source": "test/output/exampleFOO.css"
  });
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
  } catch (e) {
    expect(e.message).toMatch(/conflicting/);
  }
});

test('it should not attempt to find a sibling for a css entrypoint ', async () => {
  await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-css/global.css']}));

  const contents = metafileContents();

  expect(contents['test/output/global.css']).toEqual({
    "etag": "d861a27cb8083dd5a254c18fb47036e1",
    "file": "test/output/global-O7H3HB2W.css",
    "integrity": "az72to4rJ+UHsi96ok0AiWeFPEL974GZLzlmg0P1gGVQSVyZTLfyyXUmioJH6T3y",
    "source": "test/output/global.css"
  });
});

test('it should map typescript files', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example.ts']}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b8e7263e946f16015d9d6db02f3ea3b1",
      "file": "test/output/example.js",
      "integrity": "hTC9oniqF+c+oZF7Ih9oq7MrmKdpzzzK9/fAvd+TzCYsZ5M3PDNSXGzL2yMh42fD",
      "source": "test/output/example.js",
    },
  });
});

test('it should map typescript files that import css', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {entryPoints: ['test/input/example-with-css/example-typescript.ts']}));

  expect(metafileContents()).toEqual({
    "test/output/example-typescript.css": {
      "etag": "5d973b46d8bc32e2ca36ebd17fe45756",
      "file": "test/output/example-typescript.css",
      "integrity": "oauGpxKpeTGp8YcjhX2S+025hwtt3IfvDoDLsYGYT4hBADaX8H58dbMFja9nTIHD",
      "source": "test/output/example-typescript.css",
    },
    "test/output/example-typescript.js": {
      "etag": "0712815050e4ce939f571f14d4ca6a93",
      "file": "test/output/example-typescript.js",
      "integrity": "j1BAaq6Qu9eI0X8U43QxFNSGokmo7iEdSduzPQ/Oi98tYAOobBLvMUG+FXThNHig",
      "source": "test/output/example-typescript.js",
    },
  });
});

test('it should include an imported image file that is not an explicit entrypoint', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-image/example.js'],
    loader: {'.png': 'file'}
  }));

  const contents = metafileContents();
  expect(contents['test/output/example.js']).toEqual({
    "etag": "844cdacd41353249adeddc8c3fffc6e4",
    "file": "test/output/example-7MNN44HF.js",
    "integrity": "9NBVdQZdfB1bA4KKddlkLNBz4LnSSSH9EZsmZCesPzyPY9T2qispM/M3ojVie0fi",
    "source": "test/output/example.js"
  });
  expect(contents['test/output/example.png']).toEqual({
    "etag": "63d5a027014895f42d4deb864d539d58",
    "file": "test/output/example-KI5UE55D.png",
    "integrity": "RCAoIWtw46cYknOSs7fjnkvHvA/KAXGw0Q8UGXheWn2kV8jdArT+MR7lBCnE0L+V",
    "source": "test/output/example.png"
  });
});

test('it should include an imported image file that is not an explicit entrypoint (hash=false)', async () => {
  await require('esbuild').build(buildOptions({hash: false}, {
    entryPoints: ['test/input/example-with-image/example.js'],
    loader: {'.png': 'file'}
  }));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "931516d3df03faf2924e21a6e7186e69",
      "file": "test/output/example.js",
      "integrity": "gCUZmV3iwU2cGCbRh8pkGzpHq8l2MQgbPA8iVywuq9w8oIVH0uu1U5ZUOQvlc17O",
      "source": "test/output/example.js",
    },
    "test/output/example.png": {
      "etag": "63d5a027014895f42d4deb864d539d58",
      "file": "test/output/example.png",
      "integrity": "RCAoIWtw46cYknOSs7fjnkvHvA/KAXGw0Q8UGXheWn2kV8jdArT+MR7lBCnE0L+V",
      "source": "test/output/example.png",
    },
  });
});

test('it should include assets placed inside their own directory within the outdir', async () => {
  await require('esbuild').build(buildOptions({}, {
    entryPoints: ['test/input/example-with-image/example.js'],
    loader: {'.png': 'file'},
    assetNames: 'assets/[name]-[hash]'
  }));

  const contents = metafileContents();
  expect(contents['test/output/example.js']).toEqual({
    "etag": "3206b527f8b6495859575f938f746811",
    "file": "test/output/example-RHTDZ42D.js",
    "integrity": "S/8Dnj1T9HYLMP4GTf9MAmXHXezOEOocWbjA7xCp51YGfJJBVxEs9YCWPqeBYzDD",
    "source": "test/output/example.js"
  });
  expect(contents['test/output/assets/example.png']).toEqual({
    "etag": "63d5a027014895f42d4deb864d539d58",
    "file": "test/output/assets/example-KI5UE55D.png",
    "integrity": "RCAoIWtw46cYknOSs7fjnkvHvA/KAXGw0Q8UGXheWn2kV8jdArT+MR7lBCnE0L+V",
    "source": "test/output/assets/example.png"
  });
});

test('it should throw an error if the extensionless option is used with bundled css', async () => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({
      hash: false,
      extensionless: 'input'
    }, {entryPoints: ['test/input/example-with-css/example.js']}));
  } catch (e) {
    expect(e.message).toMatch(/conflicting manifest key.+example\.js.+example\.css/);
  }
});

test('it should allow an extensionless input', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'input'}));

  expect(metafileContents()).toEqual({
    "test/output/example": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    },
  });
});

test('it should allow an extensionless output', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: 'output'}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
});

test('it should allow an extensionless input and output by specifying true', async () => {
  await require('esbuild').build(buildOptions({hash: false, extensionless: true}));

  expect(metafileContents()).toEqual({
    "test/output/example": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
});

test('it should allow an extensionless input with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'input'}));

  expect(metafileContents()).toEqual({
    "example": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
});

test('it should allow an extensionless output with shortnames', async () => {
  await require('esbuild').build(buildOptions({hash: false, shortNames: true, extensionless: 'output'}));

  expect(metafileContents()).toEqual({
    "example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "example",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js"
    }
  });
});

test.each([
  {
    name: 'extensionless input with multiple extensions (via outExtension)',
    extensionless: 'input',
    buildOptions: {outExtension: {'.js': '.min.js'}},
    expected: {
      "test/output/example": {
        "etag": "b10922b033167718e2b3031052833770",
        "file": "test/output/example.min.js",
        "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
        "source": "test/output/example.min.js",
      },
    },
  },
  {
    name: 'extensionless output with multiple extensions (via outExtension)',
    extensionless: 'output',
    buildOptions: {outExtension: {'.js': '.min.js'}},
    expected: {
      "test/output/example.min.js": {
        "etag": "b10922b033167718e2b3031052833770",
        "file": "test/output/example",
        "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
        "source": "test/output/example.min.js",
      },
    },
  },
  {
    name: 'extensionless input should retain .map extension for sourcemaps',
    extensionless: 'input',
    buildOptions: {sourcemap: true},
    expected: {
      "test/output/example": {
        "etag": "e049bae6042c2875a1a08f0b2e861427",
        "file": "test/output/example.js",
        "integrity": "/uyTIa7xg4L04bUJBKjW5z6scVAZxR6hiKbMLD6mjzLc+5bmdZhejw9WyCYAYgeA",
        "source": "test/output/example.js",
      },
      "test/output/example.map": {
        "etag": "cb342b2c6d735815d8e4e7cbde0aa369",
        "file": "test/output/example.js.map",
        "integrity": "1KaNWheI8TZhtGHASFaPrXP+V31dIRKhtp1tWSJQ/tw25LcmrK3WgLJ0/ta+QB4r",
        "source": "test/output/example.js.map",
      },
    },
  },
  {
    name: 'extensionless output should retain .map extension for sourcemaps',
    extensionless: 'output',
    buildOptions: {sourcemap: true},
    expected: {
      "test/output/example.js": {
        "etag": "e049bae6042c2875a1a08f0b2e861427",
        "file": "test/output/example",
        "integrity": "/uyTIa7xg4L04bUJBKjW5z6scVAZxR6hiKbMLD6mjzLc+5bmdZhejw9WyCYAYgeA",
        "source": "test/output/example.js"
      },
      "test/output/example.js.map": {
        "etag": "cb342b2c6d735815d8e4e7cbde0aa369",
        "file": "test/output/example.map",
        "integrity": "1KaNWheI8TZhtGHASFaPrXP+V31dIRKhtp1tWSJQ/tw25LcmrK3WgLJ0/ta+QB4r",
        "source": "test/output/example.js.map"
      }
    },
  },
])('it should allow the extensionless option on a file with multiple extensions', async (options) => {
  await require('esbuild').build(buildOptions({
    hash: false,
    extensionless: options.extensionless
  }, options.buildOptions));

  expect(metafileContents()).toEqual(options.expected);
});

test('it should not throw an error with esbuild write=false option', async () => {
  await require('esbuild').build(buildOptions({}, {write: false}));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(false);
})

test('it should include the manifest file as part of the build result output files with the esbuild write=false option', async () => {
  const result = await require('esbuild').build(buildOptions({hash: false}, {write: false}));

  const expectedOuput = {
    "test/output/example.js": {
      "file": "test/output/example.js",
      "source": "test/output/example.js",
      "etag": "8b32f0f575840a2bec26a61625eaca2a",
      "integrity": "/C84a5gTs27+9oa3Gr1HfuQ5tz7IPGZpI88NOiBJtiygOsxHUA/ytMn97r+OOs1J",
    }
  };

  const resultOutputFiles = result.outputFiles
    // Only the generated JSON files, which will include the manifest
    .filter((outputFile: { path: any; }) => outputFile.path.endsWith('.json'))
    .map((outputFile: { path: any; text: string; }) => ({
      path: outputFile.path,
      contents: JSON.parse(outputFile.text),
    }));

  expect(resultOutputFiles).toContainEqual({
    path: path.resolve(OUTPUT_MANIFEST),
    contents: expectedOuput,
  });
});

test('it should modify result using generate function', async () => {
  await require('esbuild').build(buildOptions({
    generate: (entries: { [key: string]: string }) => {
      return {files: entries}
    }, hash: false
  }));

  expect(metafileContents()).toEqual({
    "files": {
      "test/output/example.js": {
        "etag": "b10922b033167718e2b3031052833770",
        "file": "test/output/example.js",
        "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
        "source": "test/output/example.js",
      },
    }
  });
})

test('it should only generate the manifest when the build result contains no errors', async () => {
  try {
    await require('esbuild').build(buildOptions({}, {entryPoints: ['test/input/example-with-error.js']}));
  } catch (e) {
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

  expect(metafileContents()).toEqual({
    "test/output/example.mjs": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.mjs",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.mjs",
    },
  });
});

test('it should use the same extension as the entry with useEntrypointKeys option', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true}, {outExtension: {'.js': '.mjs'}}));

  expect(metafileContents()).toEqual({
    "test/input/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.mjs",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/input/example.js",
    },
  });
});

test('it should use the same extension as the entry with useEntrypointKeys option (typescript)', async () => {
  await require('esbuild').build(buildOptions({
    hash: false,
    useEntrypointKeys: true
  }, {entryPoints: ['test/input/example.ts']}));

  expect(metafileContents()).toEqual({
    "test/input/example.ts": {
      "etag": "b8e7263e946f16015d9d6db02f3ea3b1",
      "file": "test/output/example.js",
      "integrity": "hTC9oniqF+c+oZF7Ih9oq7MrmKdpzzzK9/fAvd+TzCYsZ5M3PDNSXGzL2yMh42fD",
      "source": "test/input/example.ts",
    },
  });
});

test('it should use the same extension as the entry with useEntrypointKeys option when using outfile instead of outdir', async () => {
  await require('esbuild').build(buildOptions({hash: false, useEntrypointKeys: true}, {
    outdir: undefined,
    outfile: 'test/output/out.mjs'
  }));

  expect(metafileContents()).toEqual({
    "test/input/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/out.mjs",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/input/example.js",
    },
  });
});

test.each(['input', true])('it should not throw an error when using the useEntrypointKeys option with a compatible extensionless option', async (extensionlessOption) => {
  expect.assertions(1);

  try {
    await require('esbuild').build(buildOptions({
      hash: false,
      useEntrypointKeys: true,
      extensionless: extensionlessOption
    }));
  } catch (e) {
    // Check that the error message mentions both options
    expect(e.message).toMatch(/useEntrypointKeys.+extensionless/);
  }
});

test.each(['output', false, undefined])('it should not throw an error when using the useEntrypointKeys option with a compatible extensionless option', async (extensionlessOption) => {
  await require('esbuild').build(buildOptions({
    hash: false,
    useEntrypointKeys: true,
    extensionless: extensionlessOption
  }));

  expect(fs.existsSync(OUTPUT_MANIFEST)).toBe(true);
});

test('it is able to use extensionless=output along with useEntrypointKeys', async () => {
  await require('esbuild').build(buildOptions({
    hash: false,
    useEntrypointKeys: true,
    extensionless: 'output'
  }, {outExtension: {'.js': '.mjs'}}));

  expect(metafileContents()).toEqual({
    "test/input/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/input/example.js",
    },
  });
})

test('it should retain a previous key with append=true option', async () => {
  await require('esbuild').build(buildOptions({hash: false}));
  await require('esbuild').build(buildOptions({
    hash: false,
    append: true
  }, {entryPoints: ['test/input/pages/home/index.js']}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    },
    "test/output/index.js": {
      "etag": "4694eb03ef8c45e99982c1498c14b5d7",
      "file": "test/output/index.js",
      "integrity": "bxjaJQy+wK5iAuw4M2hS7WVPApv9sSfXyDSrlxL6ZcK2Io774FFqHhRP1HRSvy0R",
      "source": "test/output/index.js",
    },
  });
});

test('it should overwrite a previous key with append=true option if its been updated', async () => {
  // The first build will generate a manifest with a hash
  await require('esbuild').build(buildOptions({hash: true}));
  // The second build will generate a manifest without a hash
  await require('esbuild').build(buildOptions({hash: false, append: true}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    }
  });
});

test('it should not throw an error if there is no preexisting file with append=true option', async () => {
  await require('esbuild').build(buildOptions({hash: false, append: true}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    }
  });
});

test('it supports multiple output formats by using append=true and running esbuild multiple times with a different outExtension', async () => {
  await require('esbuild').build(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.mjs'}}));
  await require('esbuild').build(buildOptions({hash: false, append: true}, {outExtension: {'.js': '.cjs'}}));

  expect(metafileContents()).toEqual({
    "test/output/example.cjs": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.cjs",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.cjs",
    },
    "test/output/example.mjs": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.mjs",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.mjs",
    },
  });
});

test('it should keep the file when filter function returns true', async () => {
  await require('esbuild').build(buildOptions({filter: (filename: string) => filename.match(/example/), hash: false}));

  expect(metafileContents()).toEqual({
    "test/output/example.js": {
      "etag": "b10922b033167718e2b3031052833770",
      "file": "test/output/example.js",
      "integrity": "g9fnNEI81bgIE1qEBZAG4T/fEcHlNyHJoBu3XUvKAG3nOeMU8rJ61B/3PV+Vc48I",
      "source": "test/output/example.js",
    }
  });
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

  expect(metafileContents()['test/output/chunk-JYYV63CZ.js']).toEqual({
    "etag": "e34f96e82507dfc22c45ee0a90877f7f",
    "file": "test/output/chunk-JYYV63CZ.js",
    "integrity": "4B/PkotLJjUpXQFN5rYtHqC0Me2J6iBt3Tv9UKRx3KG5j6Mr5X5s3AqoP8UFCR0l",
    "source": "test/output/chunk-JYYV63CZ.js"
  });
  expect(metafileContents()['test/output/chunk-VDNVJE6B.js']).toEqual({
    "etag": "8d45703784911efab7b1e53b9365389b",
    "file": "test/output/chunk-VDNVJE6B.js",
    "integrity": "dpcsqKCEcpcoFjMdaxSOmLaLEwf5+/JBgUClpN3jnpq1vyMU15p3YePEI+MIJPsk",
    "source": "test/output/chunk-VDNVJE6B.js"
  });
});
