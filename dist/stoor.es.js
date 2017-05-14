var storage = {};
var inMemory = {
  getItem: function getItem (key) {
    return storage[key] || null
  },

  setItem: function setItem (key, value) {
    storage[key] = value;
    return true
  },

  removeItem: function removeItem (key) {
    if (key in storage) {
      return delete storage[key]
    }

    return false
  },

  clear: function clear () {
    storage = {};
    return true
  }
};

var Stoor = function Stoor (opts) {
  if ( opts === void 0 ) opts = { namespace: '' };

  if (!(this instanceof Stoor)) {
    return new Stoor(opts)
  }

  if (opts.storage === 'session') {
    this.storage = typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage
      : inMemory;
  } else {
    this.storage = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : inMemory;
  }

  this.namespace = opts.namespace;
};

Stoor.prototype.get = function get (key) {
    var this$1 = this;

  if (Array.isArray(key)) {
    return key.map(function (currentKey) {
      var namespacedKey = (this$1.namespace) + ":" + currentKey;
      return JSON.parse(this$1.storage.getItem(namespacedKey))
    })
  }

  var namespacedKey = (this.namespace) + ":" + key;
  return JSON.parse(this.storage.getItem(namespacedKey))
};

Stoor.prototype.set = function set (key, value) {
    var this$1 = this;

  if (Array.isArray(key)) {
    return key.map(function (pair) {
      var key = pair[0];
        var value = pair[1];
      var namespacedKey = (this$1.namespace) + ":" + key;
      return this$1.storage.setItem(namespacedKey, JSON.stringify(value))
    })
  }

  var namespacedKey = (this.namespace) + ":" + key;
  return this.storage.setItem(namespacedKey, JSON.stringify(value))
};

Stoor.prototype.remove = function remove (key) {
    var this$1 = this;

  if (Array.isArray(key)) {
    return key.map(function (currentKey) {
      var namespacedKey = (this$1.namespace) + ":" + currentKey;
      return this$1.storage.removeItem(namespacedKey)
    })
  }

  var namespacedKey = (this.namespace) + ":" + key;
  return this.storage.removeItem(namespacedKey)
};

Stoor.prototype.clear = function clear () {
  return this.storage.clear()
};

export default Stoor;
