var e={},t={getItem:function(t){return e[t]||null},setItem:function(t,r){e[t]=r},removeItem:function(t){if(t in e)return delete e[t]},clear:function(){e={}}};function r(e){if("object"==typeof e)try{return e.setItem("localStorage",1),e.removeItem("localStorage"),!0}catch(e){return!1}return!1}var o=function e(o){void 0===o&&(o={});var n=o.namespace;void 0===n&&(n="");var a=o.fallback;void 0===a&&(a=t);var i=o.storage;if(void 0===i&&(i="local"),!(this instanceof e))return new e({namespace:n,fallback:a,storage:i});if(!a.getItem||!a.setItem||!a.removeItem)throw new Error("Invalid fallback provided");this.storage="undefined"==typeof window?a:"session"===i?r(window.sessionStorage)?window.sessionStorage:a:r(window.localStorage)?window.localStorage:a,this.namespace=n};o.prototype.get=function(e,t){var r=this;if(void 0===e&&(e=""),void 0===t&&(t=null),"string"!=typeof e||!e.length)throw new Error("Invalid key provided");if(Array.isArray(e))return e.map(function(e){return JSON.parse(r.storage.getItem(r.namespace+":"+e))});var o=this.namespace+":"+e;try{var n=JSON.parse(this.storage.getItem(o));return null!==n?n:t}catch(e){return t}},o.prototype.set=function(e,t){var r=this;if("string"!=typeof e||!e.length)throw new Error("Invalid key provided");if(e&&void 0===t)throw new Error("Can not set value to undefined");return Array.isArray(e)?e.map(function(e){r.storage.setItem(r.namespace+":"+e[0],JSON.stringify(e[1]))}):(this.storage.setItem(this.namespace+":"+e,JSON.stringify(t)),this)},o.prototype.remove=function(e){var t=this;return Array.isArray(e)?e.map(function(e){return t.storage.removeItem(t.namespace+":"+e)}):(this.storage.removeItem(this.namespace+":"+e),this)},o.prototype.clear=function(){return this.storage.clear()},module.exports=o;
//# sourceMappingURL=stoor.js.map
