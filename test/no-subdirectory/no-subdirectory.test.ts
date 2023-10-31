import manifestPlugin from '../../src/index';
import fs from 'fs';
import path from 'path';

test('it should use the proper keys for the manifest when building from the same directory as the build script', async () => {
  // await require('esbuild').build(buildOptions({}, {absWorkingDir: path.join(__dirname)}));
  await require('esbuild').build({
    entryPoints: ['example.js'],
    absWorkingDir: path.join(__dirname),
    outdir: '.',
    plugins: [manifestPlugin()],
    bundle: true,
  });

  // Only worried about testing the keys here
  const contents = JSON.parse(fs.readFileSync(path.join('test', 'no-subdirectory', 'manifest.json'), 'utf-8'))
  expect(Object.keys(contents)).toEqual(['example.js', 'example.css']);

  // Remove the test artifacts
  fs.unlinkSync(path.join('test', 'no-subdirectory', 'manifest.json'));
  fs.unlinkSync(path.join('test', 'no-subdirectory', contents['example.js']));
  fs.unlinkSync(path.join('test', 'no-subdirectory', contents['example.css']));
});
