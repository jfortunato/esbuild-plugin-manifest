import {
  BuildOptions,
  BuildResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs';
import path from 'path';
import util from 'util';
import lockfile from 'proper-lockfile';

type OptionValue = boolean | 'input' | 'output';

interface ManifestEntries {
  [key: string]: string
}

interface ManifestPluginOptions {
  hash?: boolean;
  shortNames?: OptionValue;
  filename?: string;
  extensionless?: OptionValue;
  useEntrypointKeys?: boolean;
  append?: boolean;
  generate?: (entries: ManifestEntries) => Object;
  filter?: (filename: string) => boolean;
}

export = (options: ManifestPluginOptions = {}): Plugin => ({
  name: 'manifest',
  setup(build: PluginBuild) {
    build.initialOptions.metafile = true;

    // assume that the user wants to hash their files by default,
    // but don't override any hashing format they may have already set.
    const defaultHashNames = options.hash === false ? '[dir]/[name]' : '[dir]/[name]-[hash]';
    build.initialOptions.entryNames = build.initialOptions.entryNames || defaultHashNames;
    build.initialOptions.assetNames = build.initialOptions.assetNames || defaultHashNames;

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

        // When shortNames are enabled, there can be conflicting filenames.
        // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
        // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
        //
        // There are also other scenarios that can cause a conflicting filename so we'll just ensure that the key
        // we're trying to add doesn't already exist.
        if (mappings.has(input)) {
          throw new Error(`There is a conflicting manifest key for '${input}'. First conflicting output: '${mappings.get(input)}'. Second conflicting output: '${output}'.`);
        }

        mappings.set(input, output);
      }

      for (const outputFilename in result.metafile.outputs) {
        let key = unhashed(outputFilename);

        // Are we processing the entrypoint file itself or a sibling/imported file?
        const isEntryFile = result.metafile.outputs[outputFilename]!.entryPoint !== undefined;

        // If the user specified the useEntryExtension option, we'll use the entrypoint filename as the key.
        if (options.useEntrypointKeys && isEntryFile) {
          // Cannot use the useEntrypointKeys option when the extensionless option is also being used
          if (options.extensionless === true || options.extensionless === 'input') {
            throw new Error("The useEntrypointKeys option cannot be used when the extensionless option is also being used.");
          }

          key = result.metafile.outputs[outputFilename]!.entryPoint!;
        }

        addMapping(key, outputFilename);
      }

      const fullPath = pathToManifest(build.initialOptions, options);

      // If the append option is used, we'll read the existing manifest file and merge it with the new entries.
      let existingManifest: {[key: string]: string} = {};
      if (options.append) {
        try {
          existingManifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (e) { }
      }

      const entries = fromEntries(mappings, existingManifest);

      const filteredEntries = options.filter ? filterEntries(entries, options.filter) : entries;

      const resultObj = options.generate ? options.generate(filteredEntries) : filteredEntries;

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

const pathToManifest = (initialOptions: BuildOptions, pluginOptions: ManifestPluginOptions): string => {
  if (initialOptions.outdir === undefined && initialOptions.outfile === undefined) {
    throw new Error("You must specify an 'outdir' when generating a manifest file.");
  }

  let outdir = initialOptions.outdir || path.dirname(initialOptions.outfile!);

  // If the user specified an absolute working directory, we'll need to resolve the outdir relative to that.
  if (initialOptions.absWorkingDir !== undefined) {
    outdir = path.resolve(initialOptions.absWorkingDir, outdir);
  }

  const filename = pluginOptions.filename || 'manifest.json';

  return path.resolve(outdir, filename);
};

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

  // Consider the "extensionless" name of the file to be the name up until the first dot. That way a file like
  // "example.min.js" will be considered "example" and not "example.min" (which parsed.name would consider the result to be).
  let extensionlessName = parsed.base.split('.')[0];

  // Retain the .map extension on source map files, otherwise there will be a conflict with the actual source file.
  if (parsed.ext === '.map') {
    extensionlessName += '.map';
  }

  return `${dir}${extensionlessName}`;
};

const unhashed = (value: string): string => {
  const parsed = path.parse(value);

  // esbuild uses [A-Z0-9]{8} as the hash, and that is not currently configurable so we will match that exactly
  // along with any preceding character that may be a dot or a dash
  const unhashedName = parsed.name.replace(new RegExp(`[-\.]?[A-Z0-9]{8}`), '');

  return path.join(parsed.dir, unhashedName + parsed.ext);
};

const fromEntries = (map: Map<string, string>, mergeWith: ManifestEntries): ManifestEntries => {
  const obj = Array.from(map).reduce((obj: ManifestEntries, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

  return {...mergeWith, ...obj};
};

const filterEntries = (entries: ManifestEntries, filterFunction: any): ManifestEntries => {
  return Object.keys(entries)
    .filter(filterFunction)
    .reduce((obj: ManifestEntries, key) => {
      obj[key] = entries[key] as string;
      return obj;
    }, {});
};
