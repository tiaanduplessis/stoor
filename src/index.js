'use strict'

let storage = {}
const inMemory = {
  getItem (key) {
    return storage[key] || null
  },

  setItem (key, value) {
    storage[key] = value
    return true
  },

  removeItem (key) {
    if (key in storage) {
      return delete storage[key]
    }

    return false
  },

  clear () {
    storage = {}
    return true
  }
}

// http://stackoverflow.com/a/27081419
const isSupported = function (storageType) {
  if (typeof storageType === 'object') {
    try {
      storageType.setItem('localStorage', 1)
      storageType.removeItem('localStorage')
      return true
    } catch (e) {
      return false
    }
  }

  return false
}

class Stoor {
  constructor (opts = { namespace: '', fallback: inMemory }) {
    if (!(this instanceof Stoor)) {
      return new Stoor(opts)
    }

    if (!opts.fallback.getItem || !opts.fallback.setItem || !opts.fallback.removeItem) {
      throw new Error('Invalid fallback provided')
    }

    if (opts.storage === 'session') {
      this.storage = isSupported(window.sessionStorage) ? window.sessionStorage : opts.fallback
    } else {
      this.storage = isSupported(window.localStorage) ? window.localStorage : opts.fallback
    }

    this.namespace = opts.namespace
  }

  get (key) {
    if (Array.isArray(key)) {
      return key.map(currentKey => {
        const namespacedKey = `${this.namespace}:${currentKey}`
        return JSON.parse(this.storage.getItem(namespacedKey))
      })
    }

    const namespacedKey = `${this.namespace}:${key}`
    return JSON.parse(this.storage.getItem(namespacedKey))
  }

  set (key, value) {
    if (Array.isArray(key)) {
      return key.map(pair => {
        const [key, value] = pair
        const namespacedKey = `${this.namespace}:${key}`
        return this.storage.setItem(namespacedKey, JSON.stringify(value))
      })
    }

    const namespacedKey = `${this.namespace}:${key}`
    return this.storage.setItem(namespacedKey, JSON.stringify(value))
  }

  remove (key) {
    if (Array.isArray(key)) {
      return key.map(currentKey => {
        const namespacedKey = `${this.namespace}:${currentKey}`
        return this.storage.removeItem(namespacedKey)
      })
    }

    const namespacedKey = `${this.namespace}:${key}`
    return this.storage.removeItem(namespacedKey)
  }

  clear () {
    return this.storage.clear()
  }
}

export default Stoor
