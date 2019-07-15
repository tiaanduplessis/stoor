import inMemory from './in-memory'
import isSupported from './is-supported'

class Stoor {
  constructor ({ namespace = '', fallback = inMemory, storage = 'local' } = { }) {
    if (!(this instanceof Stoor)) {
      return new Stoor({ namespace, fallback, storage })
    }

    if (!fallback.getItem || !fallback.setItem || !fallback.removeItem) {
      throw new Error('Invalid fallback provided')
    }

    if (typeof window === 'undefined') {
      this.storage = fallback
    } else if (storage === 'session') {
      this.storage = isSupported(window.sessionStorage) ? window.sessionStorage : fallback
    } else {
      this.storage = isSupported(window.localStorage) ? window.localStorage : fallback
    }

    this.namespace = namespace
  }

  get (key = '', def = null) {
    if (typeof key !== 'string' || !key.length) {
      throw new Error('Invalid key provided')
    }

    if (Array.isArray(key)) {
      return key.map(currentKey => {
        const namespacedKey = `${this.namespace}:${currentKey}`
        return JSON.parse(this.storage.getItem(namespacedKey))
      })
    }

    const namespacedKey = `${this.namespace}:${key}`

    try {
      const result = JSON.parse(this.storage.getItem(namespacedKey))
      return result !== null ? result : def
    } catch (error) {
      return def
    }
  }

  set (key, value) {
    if (typeof key !== 'string' || !key.length) {
      throw new Error('Invalid key provided')
    }

    if (key && value === undefined) {
      throw new Error('Can not set value to undefined')
    }

    if (Array.isArray(key)) {
      return key.map(pair => {
        const [key, value] = pair
        const namespacedKey = `${this.namespace}:${key}`
        this.storage.setItem(namespacedKey, JSON.stringify(value))
      })
    } else {
      const namespacedKey = `${this.namespace}:${key}`
      this.storage.setItem(namespacedKey, JSON.stringify(value))
    }

    return this
  }

  remove (key) {
    if (Array.isArray(key)) {
      return key.map(currentKey => {
        const namespacedKey = `${this.namespace}:${currentKey}`
        return this.storage.removeItem(namespacedKey)
      })
    } else {
      const namespacedKey = `${this.namespace}:${key}`
      this.storage.removeItem(namespacedKey)
    }

    return this
  }

  clear () {
    return this.storage.clear()
  }
}

export default Stoor
