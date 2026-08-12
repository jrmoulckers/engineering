/**
 * Ignore globs shared by every preset. Build output, dependencies, coverage,
 * vendored upstream artifacts, and generated tool directories are never linted.
 */
export declare const sharedIgnores: string[];

/**
 * Files that legitimately write to the console and may use CommonJS: tests,
 * config, scripts, and repository tooling.
 *
 * Exported so a consumer whose layout differs can spread and extend it rather
 * than re-author the list.
 */
export declare const toolingFiles: string[];
