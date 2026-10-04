
# 📦 stoor
[![package version](https://img.shields.io/npm/v/stoor.svg?style=flat-square)](https://npmjs.org/package/stoor)
[![package downloads](https://img.shields.io/npm/dm/stoor.svg?style=flat-square)](https://npmjs.org/package/stoor)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/stoor.svg?style=flat-square)](https://npmjs.org/package/stoor)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Storage wrapper with support for namespacing, timeouts and multi get/set and remove.

## 👀 Background

This module is a small wrapper around the [local](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage) and [session](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) storage.

### Features

- Parsing and stringification of values
- Custom storage adaptor
- Plugable fallback (defaults to in memory)
- Namespacing
- Multi get, set & remove of values
- Expiring values

## Install

## ⚙️ Install

Install the package locally within you project folder with your package manager:

With `npm`:
```sh
npm install stoor
```

With `yarn`:
```sh
yarn add stoor
```

With `pnpm`:
```sh
pnpm add stoor
```

## 📖 Usage

### Kitchen sink

```ts

var things = new Stoor({ namespace: 'things' }) // Namespaced to things and uses local storage
var otherThings = new Stoor({ namespace: 'otherThings', storage: 'session' }) // Namespaced to other things and uses Session storage
things.set('foo', 1)
things.set('bar', 2)
things.set('baz', { foo: 4, baz: 4 })
console.log(things.get('baz')) // {foo: 4, baz: 4}
console.log(otherThings.get('baz')) // null
console.log(things.get(['foo', 'bar'])) // [1, 2]

things.remove(['foo', 'bar'])
console.log(things.get(['foo', 'bar'])) // [null, null]

otherThings.set([['bar', 5], ['foo', 6]]) // Array of key value pairs to multi set
console.log(otherThings.get(['foo', 'bar'])) // [6, 5]

otherThings.set('nana', 1, 5000) // Will expire within 5000 ms.
otherThings.get('nana', 3) // Returns default value if expired.

things.clear()
```

### Expiration and return values

Values are available until their timeout is reached. At or after that deadline,
`get` returns its default value (`null` when omitted). An omitted, `null`, or `0`
timeout keeps the value indefinitely. Negative timeouts are already expired.
Multi-get applies the default separately to each missing or expired key.

Single-key `set` and `remove` return the instance for chaining. Multi-set retains
its array of `undefined` results; multi-remove returns an array of the underlying
adapter's removal results. `clear()` clears the entire selected storage, including
other namespaces.

### Custom storage

You can configure any module that conforms to the the [localStorage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage)/[sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) API to be the fallback or main method of storage.


For example using [cookie-session-storage](https://github.com/tiaanduplessis/cookie-session-storage):

```ts
new Stoor({fallback: cookieSessionStorage})
new Stoor({storage: cookieSessionStorage})
```

### Asynchronous adapters

Use the separate `AsyncStoor` entry for an explicitly supplied asynchronous
adapter. The default `stoor` entry and its synchronous API are unchanged.

```ts
import AsyncStoor from 'stoor/dist/async.mjs'

// The application supplies an already initialized client, for example Redis.
const store = new AsyncStoor({
  namespace: 'settings',
  storage: {
    getItem(key) { return client.get(key) },
    async setItem(key, value) { await client.set(key, value) },
    async removeItem(key) { await client.del(key) }
  }
})

await store.set('theme', 'dark')
console.log(await store.get('theme')) // 'dark'
await store.set([['one', 1], ['two', 2]], undefined, 5000)
console.log(await store.get(['two', 'missing'], false)) // [2, false]
await store.remove(['one', 'two'])
```

CommonJS consumers use
`const { default: AsyncStoor } = require('stoor/dist/async.js')`.
Deno consumers use `import AsyncStoor from 'npm:stoor/dist/async.mjs'`.
The adapter and configuration types are exported from the same entry:

```ts
interface AsyncStorageAdapter {
  getItem(key: string): string | null | PromiseLike<string | null>
  setItem(key: string, value: string): void | PromiseLike<void>
  removeItem(key: string): void | PromiseLike<void>
}
```

Synchronous adapters also work. Methods retain their adapter receiver, and write
and removal results are discarded. `getItem` must return `null` for a missing
key. A resolved write/removal promise must acknowledge completion, rather than
just queueing work inside the adapter.

The constructor only validates the adapter's shape and namespace. It does not
call the adapter or select global storage. There is no built-in Redis client,
connection setup, credential handling, fallback, support probe, retry, cleanup,
or `clear()` method. Client connections, error listeners, retry policies and
shutdown remain the application's responsibility. Remove only explicitly named
keys with `remove`; no storage-wide operation is issued.

#### Async keys, values and expiration

The namespace defaults to `''` and must be a string without `:`. Every key must
be a nonempty string. Physical keys retain the existing `${namespace}:${key}`
format, so normal synchronous Stoor records can be shared. Existing namespaces
containing `:` are not accepted by AsyncStoor. Namespaces are not an access-control
boundary, particularly when other code also writes to the same storage.

Values retain the JSON `{ value, timeout }` envelope. JSON's usual transformations
and limitations apply: dates become strings, unsupported object properties are
omitted, and circular values or BigInt reject. Reads use the supplied default
(`null` when omitted) for missing, expired or nullish values. Other falsy values
are preserved. Adapter errors, malformed JSON, invalid envelopes and invalid
adapter return values reject the operation instead of returning its default.
Reads never remove or repair a record.

Timeouts use milliseconds. Omitted, `null` and `0` mean no expiry; negative
timeouts are already expired. Other timeouts and their computed deadlines must
be finite numbers. The deadline is captured when `set` is called, once for the
whole batch, so queue and network delays count toward expiry. Expiration is
checked after each read completes. Expired records remain stored; there are no
backend TTL commands or expiry timers.

#### Async ordering and failures

All methods return promises, including when their arguments are invalid.
Constructor configuration errors throw synchronously. Single-key `set` and
`remove` resolve to the instance; bulk forms resolve to arrays of `undefined`.
Await each operation before using its result: immediate `set(...).set(...)`
chaining is not available. Multi-get preserves input order and duplicate keys.

Each instance runs calls in invocation order, including reads, with one adapter
operation in flight at a time. A whole batch occupies one queue slot. Keys and
serialized write payloads are captured synchronously when the method is called;
later argument mutations do not change the queued operation. The slot is reserved
before validation and serialization, so calls made by a getter or `toJSON` wait
behind their parent operation even if that parent fails to serialize.

All batch keys and write payloads are validated before any adapter call. Entries
then execute sequentially, stopping at the first failure. Earlier successful
writes/removals remain applied; later entries are not attempted. A backend or
decoding failure rejects with `AsyncStoorBatchError`, exported from the async
entry, with `operation`, `index`, `key`, `completedCount` and the original `cause`.
The index is zero-based and the key is the logical key without the namespace.
`completedCount` counts acknowledged operations. A rejected write/removal may
already have committed before its connection failed; its outcome is unknown.
There is no automatic retry, rollback or partial-success return value.
Preflight validation/serialization failures reject directly before any I/O.

A failed call does not prevent later queued calls from running. Await a successful
write before relying on its outcome. An adapter promise that never settles blocks
that instance's queue. Adapter methods must not await a call back into the same
instance, since that nested call would wait behind the adapter itself. Ordering
does not extend to other instances or external writers; batches are not
transactions or consistent snapshots.

## 📚 API

### Deno 2

Use the package's ESM entry point with Deno 2:

```ts
import Stoor from 'npm:stoor/dist/index.mjs'

const persistent = new Stoor({ namespace: 'settings' })
const session = new Stoor({ namespace: 'settings', storage: 'session' })

persistent.set('theme', 'dark')
console.log(persistent.get('theme'))
```

Deno's global `localStorage` is selected by default; `storage: 'session'` selects
its global `sessionStorage`. Custom synchronous adapters still take precedence,
and unavailable or unwritable storage uses the configured fallback. Node.js
without `window` continues to use its fallback.

`localStorage` persists between executions while `sessionStorage` lasts for one
execution. Use a consistent `--location` (for example,
`deno run --location https://my-app.example app.ts`) to select a stable storage
origin. See [Deno's Web Storage documentation](https://docs.deno.com/runtime/reference/web_platform_apis/#web-storage).
The default API remains synchronous. For explicit async adapters, use the separate
AsyncStoor entry above. Raw TypeScript source imports are not supported.

For all configuration options, please see the [API docs](https://paka.dev/npm/stoor).

## 💬 Contributing

Got an idea for a new feature? Found a bug? Contributions are welcome! Please [open up an issue](https://github.com/tiaanduplessis/stoor/issues) or [make a pull request](https://makeapullrequest.com/).

### Development

Use Node.js 24.15 or later in the Node 24 line (or Node.js 22.22.2 or later in the
Node 22 line) and pnpm 10.34.4 for the development tools. The published bundles
continue to target Node.js 16 and have no runtime dependencies.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm types:check
pnpm format:check
pnpm build
pnpm coverage
pnpm test:async
```

With Deno 2 installed, run `pnpm test:deno` to type-check the built ESM consumer
and async adapter fixture, run the fake async adapter checks, and verify Web
Storage behavior across two separate Deno processes. The test
uses its own temporary storage directory and origin, disables network access,
and removes its fixtures afterward. Set `DENO_BIN` to use a specific Deno binary.

## 🪪 License

[MIT © Tiaan du Plessis](./LICENSE)
