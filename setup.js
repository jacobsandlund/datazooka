
binfo._register('setup', ['ui', 'charts'],
                function(setupApi, uiApi, chartsApi) {

  "use strict";

  var renderingApi = setupApi.dependency('rendering'),
      holder,
      dataSets = {},
      renderLater;

  uiApi.getHolder(function(_) { holder = _; });

  setupApi.renderLater = function(_) {
    if (!arguments.length) return renderLater;
    renderLater = _;
  };
  setupApi.dataSet = function(dataName, definitions) {
    var set = dataSets[dataName];
    if (!set) {
      return null;
    }
    if (definitions && !set.definitions) {
      return null;
    }
    if (!definitions && !set.complete) {
      return null;
    }
    return set;
  };

  binfo.definitionsFromJSON = function(dataName, definitions) {
    /*jshint evil:true */
    var id, defn,
        evil = [],
        evalParts = ['dimension', 'group', 'x', 'y', 'round'],
        evalPartsIfFunc = ['type', 'ordinal'];
    function makeEvil(defn, id) {
      return function(part) {
        if (!defn[part]) {
          return;
        }
        evil.push('definitions["', id, '"].', part, ' = ', defn[part], ';');
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

    for (id in definitions) {
      if (definitions.hasOwnProperty(id)) {
        defn = definitions[id];
        evalParts.forEach(makeEvil(defn, id));
        evalPartsIfFunc.forEach(maybeMakeEvil(defn, id));
      }
    }
    eval(evil.join(''));
    binfo.definitions(dataName, definitions);
  };

  binfo.definitions = function(dataName, definitions) {
    var definitionIds = [],
        id,
        firstDefinition;
    for (id in definitions) {
      if (definitions.hasOwnProperty(id)) {
        definitions[id].id = id;
        definitions[id].type = definitions[id].type || 'number';
        definitionIds.push(id);
      }
    }
    setDataSet(dataName, {definitions: definitions, definitionIds: definitionIds});
    firstDefinition = holder.selectAll('.data-name option').empty();
    holder.select('.data-name').append('option')
        .attr('value', dataName)
        .text(dataName);
    if (firstDefinition) {
      uiApi.changeDataName(dataName);
    }
  };

  binfo.dataFromUntyped = function(dataName, data) {
    if (!(dataSets[dataName] && dataSets[dataName].definitions)) {
      dataSets[dataName] = {dataUntyped: data};
      return;
    }
    var definitions = dataSets[dataName].definitions,
        ids = dataSets[dataName].definitionIds;
    data.forEach(function(d) {
      ids.forEach(function(id) {
        var defn = definitions[id];
        if (defn.derived) {
          return;
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
      });
    });
    binfo.data(dataName, data);
  };

  binfo.data = function(dataName, data) {
    setDataSet(dataName, {data: data});
  };

  function setDataSet(dataName, set) {
    var i,
        dataUntyped,
        dataSet = dataSets[dataName] = dataSets[dataName] || {};

    for (i in set) {
      if (set.hasOwnProperty(i)) {
        dataSet[i] = set[i];
      }
    }
    if (dataSet.dataUntyped) {
      dataUntyped = dataSet.dataUntyped;
      delete dataSet.dataUntyped;
      binfo.dataFromUntyped(dataName, dataUntyped);
      return;
    }
    if (dataSet.data && dataSet.definitions) {
      dataSet.complete = true;
      dataSet.charts = {};
      dataSet.chartIds = dataSet.definitionIds.slice();
      dataSet.definitionIds.forEach(function(id) {
        dataSet.charts[id] = chartsApi.barChart(dataSet.definitions[id],
                                                dataSet.data);
      });
      if (renderLater && renderLater[0] === dataName) {
        renderingApi.dataName(dataName);
        renderLater.shift();
        renderingApi.render.apply(null, renderLater);
        renderLater = null;
      }
    }
  }

});


binfo._register('hashRetrieval', ['rendering'], function(_, renderingApi) {

  "use strict";

  // Yarin's answer on this SO post:
  // http://stackoverflow.com/questions/4197591/
  // parsing-url-hash-fragment-identifier-with-javascript
  function getHashParams() {
    var hashParams = {};
    var e,
        a = /\+/g,  // Regex for replacing addition symbol with a space
        r = /([^&;=]+)=?([^&;]*)/g,
        d = function (s) { return decodeURIComponent(s.replace(a, ' ')); },
        q = window.location.hash.substring(1);

    e = r.exec(q);
    while (e) {
      hashParams[d(e[1])] = d(e[2]);
      e = r.exec(q);
    }
    return hashParams;
  }

  function renderFromHash(defaultDataName, defaultCharts, defaultFilters) {
    var params = getHashParams();
    var dataName = params.data,
        charts = params.charts && params.charts.split(','),
        filters = params.filters && params.filters.split(',');

    var myFilters = {};
    if (filters) {
      filters.forEach(function(f) {
        var filterMap = f.split('*');
        myFilters[filterMap[0]] = filterMap.slice(1);
      });
    }
    if (!dataName || !charts || !charts.length) {
      if (!arguments.length) {
        return;
      }
      dataName = defaultDataName;
      charts = defaultCharts;
      myFilters = defaultFilters;
    }
    renderingApi.dataName(dataName);
    renderingApi.render(charts, myFilters);
  }

  window.onhashchange = renderFromHash;

  binfo.renderFromHash = renderFromHash;

});


