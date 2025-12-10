[![npm version](https://img.shields.io/npm/v/@itrocks/config?logo=npm)](https://www.npmjs.org/package/@itrocks/config)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/config)](https://www.npmjs.org/package/@itrocks/config)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/config?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/config)
[![issues](https://img.shields.io/github/issues/itrocks-ts/config)](https://github.com/itrocks-ts/config/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# config

Loads and merges config.yaml files from all dependencies for unified, project-wide configuration.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/config
```

## Usage

`@itrocks/config` discovers configuration files in your project and all its
dependencies, then exposes the merged result as a single in‑memory object
named `config`.

It looks for two files in each package directory:

- `config.yaml` – main configuration,
- `local.yaml`  – local overrides.

Both are ignored if missing.

You normally:

1. Call `scanConfigFiles()` once at application startup.
2. Read values from the exported `config` object anywhere in your code.

### Minimal example

```ts
import { config, scanConfigFiles } from '@itrocks/config'

async function main()
{
  // Scan the app directory and all dependencies for config.yaml/local.yaml
  await scanConfigFiles()

  // Use the consolidated configuration
  console.log('HTTP server port:', config.server?.port)
}

main().catch(console.error)
```

Example directory layout:

```text
my-app/
  config.yaml
  local.yaml          # optional, for unversioned environment‑specific overrides and passwords
  node_modules/
    some-module/
      config.yaml
    another-module/
      config.yaml
```

All these files are merged into a single `config` object.

### Complete example with framework integration

In a typical [it.rocks](https://it.rocks) application, [@itrocks/framework](https://itrocks-ts/framework) wires
`@itrocks/config` for you:

```ts
import { compose }         from '@itrocks/compose'
import { config }          from '@itrocks/config'
import { scanConfigFiles } from '@itrocks/config'

scanConfigFiles().then(() => {
  const frameworkCompose = {
    '@itrocks/store:Store': '/store-representative:Store'
  }
  compose(__dirname, Object.assign(frameworkCompose, config.compose))
  require('@itrocks/default-action-workflow').build()
  require('./dependencies').bind()
  require('./main').run()
})
```

Each module can declare its own `config.yaml` and `local.yaml`. For example, a
mail module could define SMTP settings:

**node_modules/@itrocks/mail/config.yaml:**
```yaml
smtp:
  host:   smtp.example.org
  port:   587
  secure: false
  user:   app@example.org
  pass:   change-me
  from:
    email: no-reply@example.org
    name:  Example App
```

Your application or another module can then read these settings from the
merged configuration:

```ts
import { config } from '@itrocks/config'

const smtp = config.smtp
// smtp.host, smtp.port, smtp.from.email, ...
```

## API

### `type Config = Record<string, any>`

Shape of the global configuration object. It is a simple indexable record
where all merged configuration values are stored.

You usually do not need to construct a `Config` manually; it is provided by
this package as the `config` export.

### `const config: Config`

Global, mutable configuration object populated by `scanConfigFiles()`.

#### Behavior

- Initially an empty object `{}`.
- After calling `scanConfigFiles()` it contains the merged content of all
  discovered `config.yaml` and `local.yaml` files.
- Properties can be nested, arrays, or scalars depending on what is declared
  in your YAML files.

#### Merge rules (simplified)

When multiple files define the same keys, they are merged with the following
rules:

- **Null removes a key**: setting a key to `null` deletes it from the merged
  config.
- **Arrays are concatenated**:
  - If a value is an array, it is appended to any existing array.
  - If the existing value is not an array, it is converted to an array before
    appending.
- **Objects are deep‑merged**: nested objects are merged recursively.
- **Relative paths**: any string starting with `./` is resolved against the
  directory of the configuration file, so you can write paths relative to the
  module that declares them.
- **Menu precedence**: for the special key `menu`, entries coming from
  dependencies are inserted *before* existing ones, so modules can prepend
  their own menu items.

These rules allow modules and the main application to cooperate on a single
configuration tree without stepping on each other.

### `async function scanConfigFiles(path?: string): Promise<void>`

Scans the given directory and all its dependencies for configuration files,
then populates the global `config` object.

#### Parameters

- `path?: string` – root directory to scan. Defaults to `appDir` (from
  `@itrocks/app-dir`), which is usually your application directory.

#### Files discovered

For the root directory and for each dependency discovered via
`@itrocks/dependency`, the following files are read if they exist:

- `<module>/config.yaml`
- `<module>/local.yaml`

Each file is parsed as YAML and merged into the global `config` using the
rules described above.

#### Usage notes

- Call `await scanConfigFiles()` once at startup, before accessing `config`.
- After the scan completes, reading from `config` is synchronous and cheap.
- You normally do not need to call it again unless you expect configuration
  files to change at runtime.

## Typical use cases

- **Centralized configuration for a full application**: collect `config.yaml`
  from the app and every `@itrocks` module to get a single configuration
  object.
- **Module‑provided defaults**: ship sensible defaults in a module’s
  `config.yaml`, and let the main app override them in its own `config.yaml`
  or `local.yaml`.
- **Environment‑specific overrides**: keep shared values in `config.yaml` and
  developer‑ or environment‑specific ones in `local.yaml`, which may be
  git‑ignored.
- **Building menus and navigation**: use the special `menu` key in
  configuration to let each module contribute its own entries, automatically
  merged with others.
- **Path‑based settings**: declare relative file system paths in YAML starting
  with `./`, and let `@itrocks/config` resolve them against the module that
  declares them.
