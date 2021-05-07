import {Plugin, PluginBuild} from 'esbuild';
import fs from 'fs';
import path from 'path';

interface ManifestPluginOptions {
  hash?: boolean;
  shortNames?: boolean;
}

export = (options: ManifestPluginOptions = {}): Plugin => ({
  name: 'manifest',
  setup(build: PluginBuild) {
    build.initialOptions.metafile = true;

    // assume that the user wants to hash their files by default,
    // but don't override any hashing format they may have already set.
    if (options.hash !== false && !build.initialOptions.entryNames) {
      build.initialOptions.entryNames = '[dir]/[name]-[hash]';
    }

    build.onEnd(result => {
      // we'll map the input entry point filename to the output filename
      const entryPoints = new Map<string, string>();

      if (!result.metafile) {
        throw new Error("Expected metafile, but it does not exist.");
      }

      for (const outputFilename in result.metafile.outputs) {
        const outputInfo = result.metafile.outputs[outputFilename]!;

        // skip all outputs that don't have an entrypoint
        if (outputInfo.entryPoint === undefined) {
          continue;
        }

        const src = options.shortNames !== false ? path.basename(outputInfo.entryPoint) : outputInfo.entryPoint;

        const dest = options.shortNames !== false ? path.basename(outputFilename) : outputFilename;

        entryPoints.set(src, dest);
      }

      if (build.initialOptions.outdir === undefined) {
        throw new Error("You must specify an 'outdir' when generating a manifest file.");
      }

      const outdir = build.initialOptions.outdir;

      return fs.promises.writeFile(`${outdir}/manifest.json`,
        JSON.stringify(Object.fromEntries(entryPoints), null, 2))
    });
  }
});
