
define('datazooka', function(require, exports, module) {
  module.exports = require('datazooka/index');
});

define('datazooka/index', function(require, exports) {

  var core = require('datazooka/core'),
      definitions = {},
      data = {},
      untypedData = {};

  exports.setup = core.setup;
  exports.defaultRender = core.defaultRender;

  exports.definitionsFromJSON = function(dataName, defns) {
    /*jshint evil:true */
    var id, defn,
        evil = [],
        evalParts = ['dimension', 'group', 'round', 'x', 'y', 'format'],
        evalPartsIfFunc = ['type', 'ordinal'];
    function makeEvil(defn, id) {
      return function(part) {
        if (!defn[part]) {
          return;
        }
        evil.push('defns["', id, '"].', part, ' = ', defn[part], ';');
      };
    }
    function maybeMakeEvil(defn, id) {
      var evalPart = makeEvil(defn, id);
      return function(part) {
        if (typeof defn[part] === 'string' &&
            defn[part].slice(0, 8) === 'function') {
          evalPart(part);
        }
      };
    }

    for (id in defns) {
      if (defns.hasOwnProperty(id)) {
        defn = defns[id];
        evalParts.forEach(makeEvil(defn, id));
        evalPartsIfFunc.forEach(maybeMakeEvil(defn, id));
      }
    }
    eval(evil.join(''));
    exports.definitions(dataName, defns);
  };

  exports.definitions = function(dataName, defns) {
    var id;
    for (id in defns) {
      if (defns.hasOwnProperty(id)) {
        defns[id].id = id;
        defns[id].type = defns[id].type || 'number';
      }
    }
    definitions[dataName] = defns;
    if (untypedData[dataName]) {
      exports.dataFromUntyped(dataName, untypedData[dataName]);
    } else {
      checkLoaded(dataName);
    }
  };

  exports.dataFromUntyped = function(dataName, data) {
    if (!definitions[dataName]) {
      untypedData[dataName] = data;
      return;
    }
    var defns = definitions[dataName],
        id,
        defn;
    data.forEach(function(d) {
      for (id in defns) {
        if (!defns.hasOwnProperty(id)) {
          continue;
        }
        defn = defns[id];
        if (defn.derived) {
          continue;
        }
        if (typeof defn.type === 'function') {
          d[id] = defn.type(d[id]);
          return;
        }
        switch (defn.type) {
        case 'number':
          d[id] = +d[id];
          break;
        case 'date':
          d[id] = new Date(d[id]);
          break;
        default:
          // string, so no modification needed
        }
      }
    });
    exports.data(dataName, data);
  };

  exports.data = function(dataName, _) {
    data[dataName] = _;
    checkLoaded(dataName);
  };

  function checkLoaded(name) {
    if (definitions[name] && data[name]) {
      core.dataSet(name, definitions[name], data[name]);
    }
  }

  window.datazooka = exports;

});

