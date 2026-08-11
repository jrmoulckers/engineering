# @jrmoulckers/tsconfig

Engineering-owned TypeScript compiler configurations.

See [docs/adopting.md](../../docs/adopting.md) for installation and authentication.

## Variants

| Extend                                  | For                         | Adds over base                              |
| --------------------------------------- | --------------------------- | ------------------------------------------- |
| `@jrmoulckers/tsconfig/base.json`       | Any TypeScript              | —                                           |
| `@jrmoulckers/tsconfig/vite-app.json`   | Browser application         | DOM libs, `vite/client`, `checkJs`          |
| `@jrmoulckers/tsconfig/vite-react.json` | React browser application   | `jsx: react-jsx`, `esModuleInterop`         |
| `@jrmoulckers/tsconfig/vite-node.json`  | Build scripts, Node tooling | `node` types                                |
| `@jrmoulckers/tsconfig/next.json`       | Next.js                     | `jsx: preserve`, `incremental`, Next plugin |
| `@jrmoulckers/tsconfig/node.json`       | Node runs your `.ts` files  | `node` types, `allowImportingTsExtensions`  |

**`node.json` versus `vite-node.json`.** Use `vite-node.json` for build scripts and tooling that a
bundler loads. Use `node.json` when Node executes the TypeScript itself — `--experimental-strip-types`,
or Node 24 running TypeScript natively. Node's resolver does not remap `./x.ts` to `./x.js`, so the
specifier Node requires is the one tsc rejects without `allowImportingTsExtensions`.

That flag is not in `base.json` because it is not inert: TypeScript accepts it only alongside
`noEmit` or `emitDeclarationOnly` (`TS5096`), so hoisting it would break every package that emits.
If you need `.ts` specifiers **and** emit, set `rewriteRelativeImportExtensions: true` yourself — it
is omitted here because it requires TypeScript 5.7, below which it is a hard `TS5023` error, and
this package still supports `^5.5.0`.

Both `node.json` and `vite-node.json` set `types: ["node"]`, so install `@types/node`. Without it
the first run fails with `TS2688: Cannot find type definition file for 'node'`, which reads like a
problem with the preset rather than a missing dev dependency.

```json
{
  "extends": "@jrmoulckers/tsconfig/vite-app.json",
  "include": ["src"]
}
```

## Base settings

Beyond `strict`, the base enables the checks that catch the errors `strict` alone does not:

| Option                                  | Catches                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `noUncheckedIndexedAccess`              | Indexing an array or record without proving the element exists |
| `noImplicitOverride`                    | A method that stops overriding after a rename upstream         |
| `noFallthroughCasesInSwitch`            | A missing `break`                                              |
| `noUnusedLocals` / `noUnusedParameters` | Dead bindings                                                  |
| `verbatimModuleSyntax`                  | Type-only imports that change runtime behaviour when emitted   |
| `isolatedModules`                       | Constructs a bundler cannot transpile file-by-file             |

`exactOptionalPropertyTypes` is left **off**. It is correct but produces widespread churn in
existing code; enable it per repository when ready.

`noEmit` is on — these configs are for type-checking. A package that emits declares its own
`outDir` and `noEmit: false`.
