var e={},t={getItem:function(t){return e[t]||null},setItem:function(t,r){e[t]=r},removeItem:function(t){if(t in e)return delete e[t]},clear:function(){e={}}};function r(e){if("object"==typeof e)try{return e.setItem("localStorage",1),e.removeItem("localStorage"),!0}catch(e){return!1}return!1}var a=function e(a){void 0===a&&(a={});var n=a.namespace;void 0===n&&(n="");var o=a.fallback;void 0===o&&(o=t);var i=a.storage;if(void 0===i&&(i="local"),!(this instanceof e))return new e({namespace:n,fallback:o,storage:i});if(!o.getItem||!o.setItem||!o.removeItem)throw new Error("Invalid fallback provided");this.storage="undefined"==typeof window?o:"session"===i?r(window.sessionStorage)?window.sessionStorage:o:r(window.localStorage)?window.localStorage:o,this.namespace=n};a.prototype.get=function(e,t){var r=this;if(void 0===t&&(t=null),Array.isArray(e))return e.map(function(e){return JSON.parse(r.storage.getItem(r.namespace+":"+e))});var a=this.namespace+":"+e;try{var n=JSON.parse(this.storage.getItem(a));return null!==n?n:t}catch(e){return t}},a.prototype.set=function(e,t){var r=this;return Array.isArray(e)?e.map(function(e){r.storage.setItem(r.namespace+":"+e[0],JSON.stringify(e[1]))}):(this.storage.setItem(this.namespace+":"+e,JSON.stringify(t)),this)},a.prototype.remove=function(e){var t=this;return Array.isArray(e)?e.map(function(e){return t.storage.removeItem(t.namespace+":"+e)}):(this.storage.removeItem(this.namespace+":"+e),this)},a.prototype.clear=function(){return this.storage.clear()},module.exports=a;
//# sourceMappingURL=stoor.js.map
