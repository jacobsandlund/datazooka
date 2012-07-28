
var binfo = {
  numGroups: 35,
  tickSpacing: 46,
  compareHeightScale: 0.20,
  chartHeight: 200,
  chartPadding: 5,
  chartBorder: 5,
  maxLevels: 50,
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

  var componentNames = [],
      modules = {},
      dependencies = {},
      compFuncs = {},
      completed = {};

  function ensureExistence(dep) {
    return modules[dep] = modules[dep] || module();
  }

  function module() {
    return {
      dependency: ensureExistence
    };
  }

  return function(name, deps, component) {
    var names = componentNames,
        completedOne = true;
    names.push(name);
    ensureExistence(name);
    deps.forEach(function(d) { ensureExistence(d); });
    dependencies[name] = deps;
    compFuncs[name] = component;
    completed[name] = false;

    function notCompleted(c) {
      return !completed[c];
    }

    function completeLoop(name) {
      var func = compFuncs[name],
          deps = dependencies[name],
          compArgs;
      if (completed[name]) return;
      if (deps.some(notCompleted)) return;
      compArgs = [name].concat(deps).map(function(d) { return modules[d]; });
      compFuncs[name].apply(null, compArgs);
      completed[name] = true;
      completedOne = true;
    }

    while (names.some(notCompleted) && completedOne) {
      completedOne = false;
      names.forEach(completeLoop);
    }
  };

}());


binfo._register('rendering', ['ui', 'setup', 'charts', 'logic'],
                function(renderingApi, uiApi, setupApi, chartsApi, logicApi) {

  "use strict";

  var holder,
      chartSelection,
      chartIds,
      cross,
      crossAll,
      currentCharts,
      currentDataName,
      dataNameChanged,
      currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false,
      currentChartIds = [],
      currentShownChartIds = [],
      currentFilters = {},
      formatNumber = d3.format(',d');

  uiApi.getHolder(function(_) { holder = _; });

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  renderingApi.dataName = function(dataName) {
    currentDataName = dataName;
    dataNameChanged = true;
    uiApi.renderedDataName(dataName);
  };

  renderingApi.addChart = function(chartId) {
    renderingApi.render(currentChartIds.concat([chartId]));
  };

  renderingApi.render = function(shownChartIds, filters, smartUpdate) {

    var dataName = currentDataName,
        dataSet = setupApi.dataSet(dataName);

    if (!dataSet) {
      setupApi.renderLater([dataName, shownChartIds, filters]);
      return;
    }

    filters = filters || currentFilters;
    var data = dataSet.data,
        chartsHolder = holder.select('.charts'),
        shownChartIds,
        chartData,
        charts = dataSet.charts,
        added,
        removed;

    chartIds = shownChartIds.slice();

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

    if (!cross || dataNameChanged || removed.length || added.length) {
      if (smartUpdate) {
        return false;
      }
      if (chartsHolder.style('opacity') > 0.4) {;
        chartsHolder.style('opacity', 0.3);
        setTimeout(function() {
          renderingApi.render(shownChartIds, filters);
        }, 30);
        return true;
      }
    }
    if (!cross || dataNameChanged || removed.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      added = chartIds;
    }

    removed.forEach(function(id) {
      filters[id] = null;
      currentCharts[id].filter(null);
    });


    currentCharts = charts;
    currentChartIds = chartIds;
    currentShownChartIds = shownChartIds;
    currentFilters = filters;
    dataNameChanged = false;

    uiApi.renderOccurred();
    updateHash();

    added.forEach(function(id) {
      if (!charts[id].compare) charts[id].setCross(cross, crossAll);
    });
    added.forEach(function(id) {
      if (charts[id].compare) charts[id].setCross(cross, crossAll);
    });

    chartSelection = chartsHolder.selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();

    chartsHolder.style('opacity', null);
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

    arrangeCharts();

    return true;

  };

  function arrangeCharts() {
    var dims = {},
        widths = [],
        maxWidth = binfo.width,
        lastLevel = 0,
        maxLevel = 0,
        i;
    chartSelection.each(function(d) {
      var height = this.offsetHeight - binfo.chartBorder,
          levels = Math.ceil(height / binfo.chartHeight);
      height = levels * binfo.chartHeight - (binfo.chartBorder +
                                             2 * binfo.chartPadding);
      d3.select(this).style('height', height + 'px');
      dims[d.chart.id] = {
        levels: levels,
        width: this.offsetWidth - binfo.chartBorder
      };
    });

    for (i = 0; i < binfo.maxLevels; i++) {
      widths[i] = maxWidth;
    }
    currentShownChartIds.forEach(function(id) {
      var chart = currentCharts[id],
          levels = dims[id].levels,
          width = dims[id].width,
          fitting = 0,
          fitWidth,
          direction = -1,
          i = lastLevel,
          j;
      while (i < widths.length) {
        if (widths[i] >= width || widths[i] === maxWidth) {
          if (fitting && widths[i] === fitWidth) {
            fitting += 1;
          } else {
            fitWidth = widths[i];
            fitting = 1;
          }
        }
        if (fitting === levels) {
          break;
        }
        if (i === 0 && direction === -1) {
          direction = 1;
          i = lastLevel - levels;
          if (i < 0) {
            i = -1;
          }
          fitting = 0;
        }
        i += direction;
      }
      lastLevel = (direction === 1) ? i - levels + 1 : i;
      for (j = lastLevel; j < lastLevel + levels; j++) {
        widths[j] -= width;
      }
      maxLevel = Math.max(i, maxLevel);
      dims[id].left = maxWidth - fitWidth;
      dims[id].top = lastLevel * binfo.chartHeight;
    });

    chartSelection.each(function(d) {
      var dim = dims[d.chart.id];
      d3.select(this)
          .style('left', dim.left + 'px')
          .style('top', dim.top + 'px');
    });

    var chartHolderHeight = (maxLevel + 1) * binfo.chartHeight + 200;
    holder.select('.charts').style('height', chartHolderHeight + 'px');
  };

  function updateHash() {
    var filter, filterData,
        chartString = 'charts=',
        filterString = 'filters=',
        filterArray = [];

    chartString += currentShownChartIds.map(function(id) {
      return currentCharts[id].id;
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

  renderingApi.filter = function(id, range) {
    currentFilters[id] = range;
    currentCharts[id].filter(range);
    renderAll();
    updateHash();
  };

  renderingApi.given = function(id, given) {
    renderingApi.filter(id, given ? [given] : null);
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
    chartIds.forEach(function(id) { currentCharts[id].update(); });
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(crossAll.value()));
  }

});

