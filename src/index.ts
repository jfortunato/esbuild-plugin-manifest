import {
  Metafile,
  Plugin,
  PluginBuild
} from 'esbuild';
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

      const addEntrypoint = (entryPoint: string, outputFilename: string) => {
        // check if the shortNames option is being used on the input or output
        let input = shouldModify('input', options.shortNames) ? shortName(entryPoint) : entryPoint;
        let output = shouldModify('output', options.shortNames) ? shortName(outputFilename) : outputFilename;

        // check if the extensionless option is being used on the input or output
        input = shouldModify('input', options.extensionless) ? extensionless(input) : input;
        output = shouldModify('output', options.extensionless) ? extensionless(output) : output;

        // When shortNames are enabled, there can be conflicting filenames.
        // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
        // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
        //TODO: This should also fail when it's running extensionless and bundles CSS
        if (options.shortNames === true && entryPoints.has(input)) {
          throw new Error(`There is a conflicting shortName for '${input}'.`);
        }

        if (entryPoints.has(input)) {
        //  throw new Error(`There is a conflicting input for '${input}' (entrypoint: '${output}').`);
        }

        entryPoints.set(input, output);
      }

      for (const outputFilename in result.metafile.outputs) {
        const outputInfo = result.metafile.outputs[outputFilename]!;

        if (outputInfo.entryPoint) {
          addEntrypoint(outputInfo.entryPoint, outputFilename);
        } else {
          const extension = outputFilename.split('.').pop()
          if (extension !== "css") {
            continue; // We will *only* modify css outputs
          }

          const isUnique = (input:string, index: number, self: Array<string>) => index === self.indexOf(input);
          let mapEntrypointWithExtension = (entrypoint:string) => entrypoint.split('.').slice(0, -1).join('.') + "." + extension;
          Object.keys(outputInfo.inputs)
            .map(inputFilename => findEntryPoints(result.metafile!, inputFilename))
            .reduce((previousValue, currentValue) => [...previousValue, ...currentValue], [])
            .filter(isUnique)
            .map(mapEntrypointWithExtension)
            .forEach(entrypoint => addEntrypoint(entrypoint, outputFilename))
        }
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

const findEntryPoints = (metafile: Metafile, inputName: string): Array<string> => {
  const entrypoints = new Array<string>()
  for (let [outputFilename, outputObject] of Object.entries(metafile.outputs)) {
    if (Object.keys(outputObject.inputs).includes(inputName)) {
      if (outputObject.entryPoint) {
        entrypoints.push(outputObject.entryPoint)
      } else {
        entrypoints.concat(findEntryPoints(metafile, outputFilename))
      }
    }
  }

  return entrypoints
}

const fromEntries = (map: Map<string, string>): {[key: string]: string} => {
  return Array.from(map).reduce((obj: {[key: string]: string}, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
};
