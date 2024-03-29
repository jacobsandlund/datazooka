
define('index', function(require, exports) {

  require('./hash_retrieval');

  var easydemo = require('./easydemo'),
      core = require('./core'),
      definitions = {},
      data = {},
      untypedData = {};

  exports.setup = core.setup;
  exports.defaultRender = core.defaultRender;
  exports.renderFresh = core.renderFresh;

  exports.demo = function(dataName, title, states) {
    easydemo.delay = 350;
    var render = function(params) {
      return function(finished) {
        datazooka.renderFresh(dataName, params.ids, params, finished);
      };
    };
    states = states.map(function(s, i) {
      return {
        enter: s.enter || render(s),
        signals: s.signals,
        exit: s.exit,
      };
    });
    d3.selectAll('#demo-text > p').each(function(d, i) {
      states[i].text = this.innerHTML;
    });
    easydemo.start('DataZooka - ' + title, states);
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

