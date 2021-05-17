import {Plugin, PluginBuild} from 'esbuild';
import fs from 'fs';
import path from 'path';

type OptionValue = boolean | 'input' | 'output';

interface ManifestPluginOptions {
  hash?: boolean;
  shortNames?: OptionValue;
  filename?: string;
  extensionless?: OptionValue;
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

        let input = outputInfo.entryPoint;

        let output = outputFilename;

        // check if the shortNames option is being used on the input or output
        input = shouldModify('input', options.shortNames) ? shortName(input) : input;
        output = shouldModify('output', options.shortNames) ? shortName(output) : output;

        // check if the extensionless option is being used on the input or output
        input = shouldModify('input', options.extensionless) ? extensionless(input) : input;
        output = shouldModify('output', options.extensionless) ? extensionless(output) : output;

        // When shortNames are enabled, there can be conflicting filenames.
        // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
        // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
        if (options.shortNames === true && entryPoints.has(input)) {
          throw new Error(`There is a conflicting shortName for '${input}'.`);
        }

        entryPoints.set(input, output);
      }

      if (build.initialOptions.outdir === undefined && build.initialOptions.outfile === undefined) {
        throw new Error("You must specify an 'outdir' when generating a manifest file.");
      }

      const outdir = build.initialOptions.outdir || path.dirname(build.initialOptions.outfile!);

      const filename = options.filename || 'manifest.json';

      return fs.promises.writeFile(`${outdir}/${filename}`,
        JSON.stringify(fromEntries(entryPoints), null, 2))
    });
  }
});

const shouldModify = (inputOrOutput: 'input'|'output', optionValue?: OptionValue): boolean => {
  return optionValue === inputOrOutput || optionValue === true;
};

const shortName = (value: string): string => {
  return path.basename(value);
};

const extensionless = (value: string): string => {
  const parsed = path.parse(value);

  const dir = parsed.dir !== '' ? `${parsed.dir}/` : '';

  return `${dir}${parsed.name}`;
};

const fromEntries = (map: Map<string, string>): {[key: string]: string} => {
  return Array.from(map).reduce((obj: {[key: string]: string}, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
};
