<h1 align="center">📦 stoor</h1>
<div align="center">
  <strong>Local and Session storage wrapper with support for namespacing and multi get, set and remove</strong>
</div>
<br>
<div align="center">
  <a href="https://npmjs.org/package/stoor">
    <img src="https://img.shields.io/npm/v/stoor.svg?style=flat-square" alt="Package version" />
  </a>
  <a href="https://npmjs.org/package/stoor">
  <img src="https://img.shields.io/npm/dm/stoor.svg?style=flat-square" alt="Downloads" />
  </a>
  <a href="https://github.com/feross/standard">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square" alt="Standard" />
  </a>
  <a href="https://travis-ci.org/tiaanduplessis/stoor">
    <img src="https://img.shields.io/travis/tiaanduplessis/stoor.svg?style=flat-square" alt="Travis Build" />
  </a>
  <a href="https://badge.fury.io/gh/tiaanduplessis%2Fstoor">
    <img src="https://badge.fury.io/gh/tiaanduplessis%2Fstoor.svg?style=flat-square" alt="GitHub version" />
  </a>
    <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/tiaanduplessis/stoor.svg" alt="Greenkeeper" />
  </a>
  <a href="https://github.com/tiaanduplessis/stoor/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/stoor.svg?style=flat-square" alt="License" />
  </a>
  <a href="http://makeapullrequest.com">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs" />
  </a>
</div>

<h2>Table of Contents</h2>
<details>
  <summary>Table of Contents</summary>
  <li><a href="#about">About</a></li>
  <li><a href="#install">Install</a></li>
  <li><a href="#usage">Usage</a></li>
  <li><a href="#contribute">Contribute</a></li>
  <li><a href="#license">License</a></li>
</details>

## About

This module is a small wrapper (595 bytes gzipped) around the [localStorage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage) and [session](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) that provides:

- Parsing and stringification of values
- Plugable fallback (defaults to in memory)
- Namespacing
- Multi get, set & remove of values

## Install

With package manager:

```sh
$ npm install --save stoor
# OR
$ yarn add stoor
```

Or with CDN:

```html
<script src="https://unpkg.com/stoor/dist/stoor.umd.js"></script>
```

## Usage

This example shows the entire API in use:

```js

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

	things.clear()

```

You can configure any module that conforms to the the [localStorage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage)/[sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) API to be the fallback, for example using [cookie-session-storage](https://github.com/tiaanduplessis/cookie-session-storage):

```js
new Stoor({fallback: cookieSessionStorage})

// Use as normal
```

## Contribute

Contributions are welcome. Please open up an issue or create PR if you would like to help out.

## License

Licensed under the MIT License.
