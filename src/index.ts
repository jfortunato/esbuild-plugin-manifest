import {
  BuildResult, Metafile,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs';
import path from 'path';
import util from 'util';
import lockfile from 'proper-lockfile';

type OptionValue = boolean | 'input' | 'output';

interface ManifestPluginOptions {
  hash?: boolean;
  shortNames?: OptionValue;
  filename?: string;
  extensionless?: OptionValue;
  useEntryExtension?: boolean;
  append?: boolean;
  generate?: (entries: {[key: string]: string}) => Object;
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

    build.onEnd((result: BuildResult) => {
      // Only proceed if the build result does not have any errors.
      if (result.errors.length > 0) {
        return;
      }

      // we'll map the input entry point filename to the output filename
      const mappings = new Map<string, string>();

      if (!result.metafile) {
        throw new Error("Expected metafile, but it does not exist.");
      }

      const addMapping = (inputFilename: string, outputFilename: string) => {
        // check if the shortNames option is being used on the input or output
        let input = shouldModify('input', options.shortNames) ? shortName(inputFilename) : inputFilename;
        let output = shouldModify('output', options.shortNames) ? shortName(outputFilename) : outputFilename;

        // check if the extensionless option is being used on the input or output
        input = shouldModify('input', options.extensionless) ? extensionless(input) : input;
        output = shouldModify('output', options.extensionless) ? extensionless(output) : output;

        // By default, we want to use the same extension for the key as the output file.
        if (!options.useEntryExtension) {
          const inputExtension = path.parse(inputFilename).ext;
          const outputExtension = path.parse(outputFilename).ext;
          input = input.replace(inputExtension, outputExtension);
        } else {
          // Cannot use the useEntryExtension option when the extensionless option is also being used
          if (options.extensionless === true || options.extensionless === 'input') {
            throw new Error("The useEntryExtension option cannot be used when the extensionless option is also being used.");
          }
        }

        // When shortNames are enabled, there can be conflicting filenames.
        // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
        // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
        //
        // There are also other scenarios that can cause a conflicting filename so we'll just ensure that the key
        // we're trying to add doesn't already exist.
        if (mappings.has(input)) {
          throw new Error("There is a conflicting manifest key for '"+input+"'.");
        }

        mappings.set(input, output);
      }

      for (const outputFilename in result.metafile.outputs) {
        const outputInfo = result.metafile.outputs[outputFilename]!;

        // skip all outputs that don't have an entrypoint
        if (!outputInfo.entryPoint) {
          continue;
        }

        addMapping(outputInfo.entryPoint, outputFilename);

        // Check if this entrypoint has a "sibling" css file
        // When esbuild encounters js files that import css files, it will gather all the css files referenced from the
        // entrypoint and bundle it into a single sibling css file that follows the same naming structure as the entrypoint.
        // So what we can do is simply check the outputs for a sibling file that matches the naming structure.
        const siblingCssFile = findSiblingCssFile(result.metafile, outputFilename);

        if (siblingCssFile !== undefined) {
          // a sibling css file will always be given the same base name as its .js entrypoint,
          // so it will always cause a conflict when used with the extensionless option
          if (options.extensionless === true || options.extensionless === 'input') {
            throw new Error(`The extensionless option cannot be used when css is imported.`);
          }

          addMapping(siblingCssFile.input, siblingCssFile.output);
        }
      }

      if (build.initialOptions.outdir === undefined && build.initialOptions.outfile === undefined) {
        throw new Error("You must specify an 'outdir' when generating a manifest file.");
      }

      const outdir = build.initialOptions.outdir || path.dirname(build.initialOptions.outfile!);

      const filename = options.filename || 'manifest.json';

      const fullPath = path.resolve(`${outdir}/${filename}`);

      // If the append option is used, we'll read the existing manifest file and merge it with the new entries.
      let existingManifest: {[key: string]: string} = {};
      if (options.append) {
        try {
          existingManifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (e) { }
      }

      const entries = fromEntries(mappings, existingManifest);

      const resultObj = options.generate ? options.generate(entries) : entries;

      const text = JSON.stringify(resultObj, null, 2);

      // With the esbuild write=false option, nothing will be written to disk. Instead, the build
      // result will have an "outputFiles" property containing all the files that would have been written.
      // We want to add the manifest file as one of those "outputFiles".
      if (build.initialOptions.write === false) {
        result.outputFiles?.push({
          path: fullPath,
          contents: new util.TextEncoder().encode(text),
          get text() {
            return text;
          }
        });

        return;
      }

      return writeFileWithLock(fullPath, text);
    });
  }
});

const writeFileWithLock = async (fullPath: string, text: string): Promise<void> => {
  // Retry up to 5 times, using exponential backoff but capped at 100ms between retries
  // See: https://github.com/tim-kos/node-retry#retrytimeoutsoptions for an explanation of the options
  const retryOptions = {
    retries: {
      retries: 5,
      minTimeout: 10,
      maxTimeout: 100,
    }
  };

  try {
    // Ensure the file exists before we try to lock it
    await ensureFile(fullPath);
    // Lock the file, write the contents, then release the lock
    const release = await lockfile.lock(fullPath, retryOptions);
    await fs.promises.writeFile(fullPath, text);
    await release();
  } catch (e) {
    console.error(e);
  }
};

// Creates the file if it does not exist, otherwise does nothing. We need to do this because
// the lockfile library will throw an error if the file does not exist already.
const ensureFile = async (fullPath: string): Promise<void> => {
  try {
    await fs.promises.access(fullPath)
  } catch (err) {
    // If the error is not that the file does not exist, rethrow it
    if (err.code !== 'ENOENT') {
      throw err;
    }

    // We got an ENOENT error, so create the file
    await fs.promises.writeFile(fullPath, '');
  }
};

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

const findSiblingCssFile = (metafile: Metafile, outputFilename: string): {input: string, output: string}|undefined => {
  if (!outputFilename.endsWith('.js')) {
    return;
  }

  // we need to determine the difference in filenames between the input and output of the entrypoint, so that we can
  // use that same logic to match against a potential sibling file
  const entry = metafile.outputs[outputFilename]!.entryPoint!;

  // "example.js" => "example"
  const entryWithoutExtension = path.parse(entry).name;

  // "example-GQI5TWWV.js" => "example-GQI5TWWV"
  const outputWithoutExtension = path.basename(outputFilename).replace(/\.js$/, '');

  // "example-GQI5TWWV" => "-GQI5TWWV"
  const diff = outputWithoutExtension.replace(entryWithoutExtension, '');

  // esbuild uses [A-Z0-9]{8} as the hash, and that is not currently configurable so we should be able
  // to match that exactly in the diff and replace it with the regex so we're left with:
  // "-GQI5TWWV" => "-[A-Z0-9]{8}"
  const hashRegex = new RegExp(diff.replace(/[A-Z0-9]{8}/, '[A-Z0-9]{8}'));

  // the sibling entry is expected to be the same name as the entrypoint just with a css extension
  const potentialSiblingEntry = path.parse(entry).dir + '/' + path.parse(entry).name + '.css';

  const potentialSiblingOutput = outputFilename.replace(hashRegex, '').replace(/\.js$/, '.css');

  const found = Object.keys(metafile.outputs).find(output => output.replace(hashRegex, '') === potentialSiblingOutput);

  return found ? { input: potentialSiblingEntry, output: found } : undefined;
};

const fromEntries = (map: Map<string, string>, mergeWith: {[key: string]: string}): {[key: string]: string} => {
  const obj = Array.from(map).reduce((obj: {[key: string]: string}, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

  return {...mergeWith, ...obj};
};
