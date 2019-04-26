let storage = {}

const inMemory = {
  getItem (key) {
    return storage[key] || null
  },

  setItem (key, value) {
    storage[key] = value
  },

  removeItem (key) {
    if (key in storage) {
      return delete storage[key]
    }
  },

  clear () {
    storage = {}
  }
}

export default inMemory
