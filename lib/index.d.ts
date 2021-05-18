import { Plugin } from 'esbuild';
declare type OptionValue = boolean | 'input' | 'output';
interface ManifestPluginOptions {
    hash?: boolean;
    shortNames?: boolean;
    filename?: string;
    extensionless?: OptionValue;
}
declare let Plugin: (options?: ManifestPluginOptions) => Plugin;
export = Plugin;
