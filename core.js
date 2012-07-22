
var binfo = {
  numGroups: 35,
  tickSpacing: 44,
  compareHeightScale: 0.20,
  chartDimensions: {
    top: 20,
    right: 10,
    bottom: 20,
    left: 10,
    height: 100,
    width: 100,
    binWidth: 12
  }
};


binfo._register = (function() {

  "use strict";

  var components = {},
      componentNames = ['logic', 'charts', 'setup',
                        'rendering', 'hashRetrieval'];

  return function(name, deps, component) {
    var names = componentNames;
    if (components[name] || names.indexOf(name) < 0) {
      return;
    }
    components[name] = {component: component, dependencies: deps};
    if (names.some(function(c) { return !components[c]; })) {
      return;
    }
    binfo._register = null;
    var dependencies = {},
        compFuncs = {},
        completed = {};

    names.forEach(function(c) {
      dependencies[c] = components[c].dependencies;
      compFuncs[c] = components[c].component;
    });

    function notCompleted(c) {
      return !completed[c];
    }

    function completeLoop(name) {
      var func = compFuncs[name],
          deps = dependencies[name],
          compDeps,
          me;
      if (completed[name]) return;
      if (deps.some(notCompleted)) return;
      compDeps = deps.map(function(d) { return completed[d]; });
      me = compFuncs[name].apply(null, compDeps);
      completed[name] = me ? me : true;
    }

    while (names.some(notCompleted)) {
      names.forEach(completeLoop);
    }
  };

}());


binfo._register('setup', ['charts'], function(chartsApi) {

  "use strict";

  var holder,
      renderLater,
      dataSets = {},
      setupApi = {};

  setupApi.holder = function() { return holder; };
  setupApi.renderLater = function(_) {
    if (!arguments.length) return renderLater;
    renderLater = _;
  };
  setupApi.dataSet = function(dataName) {
    var set = dataSets[dataName];
    if (!set || !set.complete) {
      return null;
    }
    return set;
  };

  binfo.holder = function(_) {
    holder = d3.select(_);

    // Create skeleton.
    var config = holder.append('div')
        .attr('class', 'configuration');
    config.append('select')
        .attr('class', 'dataName')
        .on('change', changeDataName);

    config.append('select')
        .attr('class', 'definitionIds')
        .attr('multiple', 'multiple');

    config.append('div')
        .text('Update')
        .attr('class', 'button')
        .on('click', function() {
          var charts = [];
          holder.selectAll('.definitionIds option').each(function() {
            if (this.selected) {
              charts.push(this.value);
            }
          });
          var dataName = holder.select('.dataName').property('value');
          binfo.render(dataName, charts);
        });

    holder.append('div')
        .attr('class', 'charts');

    var totals = holder.append('aside')
        .attr('class', 'totals');
    totals.append('span')
        .attr('class', 'active')
        .text('-');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total');
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
        id;
    for (id in definitions) {
      if (definitions.hasOwnProperty(id)) {
        definitions[id].id = id;
        definitions[id].type = definitions[id].type || 'number';
        definitionIds.push(id);
      }
    }
    setDataSet(dataName, {definitions: definitions, definitionIds: definitionIds});
    holder.select('.dataName').append('option')
        .attr('value', dataName)
        .text(dataName);
    if (holder.selectAll('.dataName option').length <= 1) {
      changeDataName();
    }
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
      dataSet.compares = {};
      dataSet.definitionIds.forEach(function(id) {
        dataSet.charts[id] = chartsApi.barChart(dataSet.definitions[id],
                                                dataSet.data);
      });
      if (renderLater && renderLater[0] === dataName) {
        binfo.render.apply(null, renderLater);
        renderLater = null;
      }
    }
  }

  function changeDataName() {
    var dataName = holder.select('.dataName').property('value');
    var options = holder.select('.definitionIds').selectAll('option')
        .data(dataSets[dataName].definitionIds);
    options.enter().append('option');
    options
        .attr('value', function(d) { return d; })
        .text(function(d) { return d; });
    options.exit().remove();
  }

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

  return setupApi;
});


binfo._register('hashRetrieval', [], function() {

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

  function renderFromHash() {
    var params = getHashParams();
    var dataName = params.data,
        charts = params.charts && params.charts.split(','),
        filters = params.filters && params.filters.split(','),
        compares = params.compares && params.compares.split(',');

    var myFilters = {};
    if (filters) {
      filters.forEach(function(f) {
        var filterMap = f.split('*');
        myFilters[filterMap[0]] = filterMap.slice(1);
      });
    }
    if (!dataName) {
      return false;
    }
    binfo.render(dataName, charts, myFilters, compares);
    return true;
  }

  window.onhashchange = renderFromHash;

  binfo.renderFromHash = renderFromHash;

});



binfo._register('rendering', ['setup', 'charts', 'logic'],
                function(setupApi, chartsApi, logicApi) {

  "use strict";

  var chartSelection,
      cross,
      crossAll,
      charts,
      compares,
      currentDataName,
      currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false,
      currentChartIds = [],
      currentCompareIds = [],
      currentFilters = {},
      formatNumber = d3.format(',d');


  binfo.render = function(dataName, chartIds, filters, compareIds) {

    var dataSet = setupApi.dataSet(dataName);

    if (!dataSet) {
      setupApi.renderLater([dataName, chartIds, filters, compareIds]);
      return;
    }

    filters = filters || {};
    compareIds = compareIds || [];
    var data = dataSet.data,
        addedCompares = [],
        holder = setupApi.holder(),
        rawCompareIds = compareIds;

    charts = dataSet.charts;
    compares = dataSet.compares;

    var chartData = chartIds.map(function(id) {
      return {
        chart: charts[id],
        compare: false,
        orientFlip: charts[id].defaultOrientFlip
      };
    });
    compareIds = [];
    rawCompareIds.forEach(function(raw) {
      var id = logicApi.compareIdFromRaw(raw);
      compareIds.push(id);
      if (!compares[id]) {
        compares[id] = chartsApi.compareChart({id: id, raw: raw, charts: charts});
        addedCompares.push(id);
      }
      compares[id].addChartIds(chartIds);
      chartData.push({chart: compares[id], compare: false, orientFlip: false});
    });

    var removed = currentChartIds.filter(function(id) {
      return chartIds.indexOf(id) < 0;
    });
    var added = chartIds.filter(function(id) {
      return currentChartIds.indexOf(id) < 0;
    });

    if (!cross || currentDataName !== dataName || removed.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      added = chartIds;
      addedCompares = compareIds;
    }
    currentChartIds = chartIds;
    currentCompareIds = compareIds;
    currentDataName = dataName;
    currentFilters = filters;

    updateHash();

    added.forEach(function(id) { charts[id].setCross(cross, crossAll); });
    addedCompares.forEach(function(id) { compares[id].setCross(cross, crossAll); });

    if (added.length || removed.length) {

      chartSelection = holder.select('.charts').selectAll('.chart')
          .data(chartData, function(d) { return d.chart.id; });

      chartSelection.enter()
        .append('div')
          .attr('class', 'chart')
        .append('div')
          .attr('class', 'title');

      chartSelection.exit().remove();

      chartSelection.order();

      holder.select('.total')
          .text(formatNumber(cross.size()) + ' ' + dataName + ' selected.');

      renderAll();
    }


    chartIds.forEach(function(id) {
      if (filters[id]) {
        charts[id].filter(filters[id]);
      } else {
        charts[id].filter(null);
      }
    });

    renderAll();

  };

  function updateHash() {
    var filter, filterData,
        chartString = 'charts=' + currentChartIds.join(','),
        compareString = 'compares=',
        filterString = 'filters=',
        filterArray = [];

    compareString += currentCompareIds.map(function(id) {
      return compares[id].rawId();
    }).join(',');

    function filterEncode(d) {
      if (typeof d === 'object') {
        d = d.valueOf();
      }
      return encodeURIComponent(d);
    }
    for (filter in currentFilters) {
      if (currentFilters.hasOwnProperty(filter) && currentFilters[filter]) {
        filterData = currentFilters[filter].map(filterEncode).join('*');
        filterArray.push(filter + '*' + filterData);
      }
    }
    filterString += filterArray.join(',');
    var params = ['data=' + currentDataName, chartString,
                  compareString, filterString].join('&');
    currentHash = '#' + params;
    hashNeedsUpdated = true;
    if (!hashUpdatedRecently) {
      updateWindowHash();
    }
  }

  function updateWindowHash() {
    hashUpdatedRecently = false;
    if (hashNeedsUpdated) {
      window.history.replaceState({}, '', currentHash);
      setTimeout(updateWindowHash, 300);
      hashUpdatedRecently = true;
      hashNeedsUpdated = false;
    }
  }

  binfo.filter = function(id, range) {
    currentFilters[id] = range;
    charts[id].filter(range);
    renderAll();
    updateHash();
  };


  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      var method = chartData.chart[name];
      if (method) {
        d3.select(this).each(method);
      }
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('cleanUp');

  function renderAll() {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active').text(formatNumber(crossAll.value()));
  }

});

