
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

### Custom storage

You can configure any module that conforms to the the [localStorage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage)/[sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) API to be the fallback or main method of storage.


For example using [cookie-session-storage](https://github.com/tiaanduplessis/cookie-session-storage):

```ts
new Stoor({fallback: cookieSessionStorage})
new Stoor({storage: cookieSessionStorage})
```

## 📚 API

For all configuration options, please see the [API docs](https://paka.dev/npm/stoor).

## 💬 Contributing

Got an idea for a new feature? Found a bug? Contributions are welcome! Please [open up an issue](https://github.com/tiaanduplessis/stoor/issues) or [make a pull request](https://makeapullrequest.com/).

## 🪪 License

[MIT © Tiaan du Plessis](./LICENSE)
    