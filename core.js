
var binfo = {
  numGroups: 35,
  tickSpacing: 46,
  compareHeightScale: 0.20,
  chartDimensions: {
    top: 20,
    right: 10,
    bottom: 20,
    left: 10,
    height: 100,
    width: 100,
    binWidth: 11
  }
};


binfo._register = (function() {

  "use strict";

  var components = {},
      componentNames = ['logic', 'hashRetrieval', 'charts',
                        'drag', 'setup', 'rendering'];

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
        filters = params.filters && params.filters.split(',');

    var myFilters = {};
    if (filters) {
      filters.forEach(function(f) {
        var filterMap = f.split('*');
        myFilters[filterMap[0]] = filterMap.slice(1);
      });
    }
    if (!dataName || !charts || !charts.length) {
      return false;
    }
    binfo.render(dataName, charts, myFilters);
    return true;
  }

  window.onhashchange = renderFromHash;

  binfo.renderFromHash = renderFromHash;

});



binfo._register('rendering', ['setup', 'charts', 'logic'],
                function(setupApi, chartsApi, logicApi) {

  "use strict";

  var chartSelection,
      chartIds,
      cross,
      crossAll,
      charts,
      currentDataName,
      currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false,
      currentChartIds = [],
      currentShownChartIds = [],
      currentFilters = {},
      formatNumber = d3.format(',d');

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  binfo.render = function(dataName, renderChartIds, filters, autoUpdate) {

    var dataSet = setupApi.dataSet(dataName);

    if (!dataSet) {
      setupApi.renderLater([dataName, renderChartIds, filters]);
      return;
    }

    filters = filters || currentFilters;
    var data = dataSet.data,
        holder = setupApi.holder(),
        shownChartIds,
        chartData,
        added,
        removed;

    charts = dataSet.charts;
    chartIds = renderChartIds;
    shownChartIds = chartIds.slice();

    chartData = shownChartIds.map(function(id, i) {
      if (!charts[id]) {
        // Must be a compare chart
        charts[id] = chartsApi.compareChart({id: id, charts: charts});
      }
      if (charts[id].compare) {
        chartIds = charts[id].addChartIds(chartIds);
      }
      return {
        chart: charts[id],
        compare: charts[id].compare,
        orientFlip: charts[id].defaultOrientFlip
      };
    });

    removed = arrayDiff(currentChartIds, chartIds);
    added = arrayDiff(chartIds, currentChartIds);

    if (!cross || currentDataName !== dataName || removed.length) {
      if (autoUpdate) {
        return false;
      }
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      added = chartIds;
    }
    if (autoUpdate && added.length) {
      return false;
    }

    removed.forEach(function(id) {
      filters[id] = null;
      charts[id].filter(null);
    });

    currentChartIds = chartIds;
    currentShownChartIds = shownChartIds;
    currentDataName = dataName;
    currentFilters = filters;

    setupApi.updateUponRender(dataName, shownChartIds);
    updateHash();

    added.forEach(function(id) {
      if (!charts[id].compare) charts[id].setCross(cross, crossAll);
    });
    added.forEach(function(id) {
      if (charts[id].compare) charts[id].setCross(cross, crossAll);
    });

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

    chartIds.forEach(function(id) {
      if (filters[id]) {
        charts[id].filter(filters[id]);
      } else {
        charts[id].filter(null);
      }
    });

    renderAll();

    return true;
  };

  function updateHash() {
    var filter, filterData,
        chartString = 'charts=',
        filterString = 'filters=',
        filterArray = [];

    chartString += currentShownChartIds.map(function(id) {
      return charts[id].id;
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
    var params = ['data=' + currentDataName, chartString, filterString].join('&');
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

  chartsApi.filter = function(id, range) {
    currentFilters[id] = range;
    charts[id].filter(range);
    renderAll();
    updateHash();
  };

  chartsApi.given = function(id, given) {
    chartsApi.filter(id, given ? [given] : null);
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

  var renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('cleanUp');

  function renderAll() {
    chartIds.forEach(function(id) { charts[id].update(); });
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(crossAll.value()));
  }

});

