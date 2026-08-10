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
