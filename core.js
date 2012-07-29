
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


binfo._register('core', [], function(coreApi) {

  var uiApi = coreApi.dependency('ui'),
      renderingApi = coreApi.dependency('rendering'),
      chartsApi = coreApi.dependency('charts'),
      dataSets = {},
      cross,
      crossAll,
      updateMode = 'always',
      renderFreshLater,
      needsToUpdate = true,
      updating,
      addedIds,
      removedIds,
      dataName,
      chartIds = [],
      charts,
      nextDataName,
      nextChartIds,
      nextCharts;

  coreApi.dataSet = function(name, definitions, data) {
    var set,
        id;
    if (!definitions) {
      set = dataSets[name];
      if (!set) {
        return null;
      }
      return set;
    }
    dataSets[name] = set = {definitions: definitions, data: data};
    set.definitionIds = [];
    set.charts = {};
    for (id in definitions) {
      if (definitions.hasOwnProperty(id)) {
        set.charts[id] = chartsApi.barChart(definitions[id], data)
        set.definitionIds.push(id);
      }
    }
    set.chartIds = set.definitionIds.slice();
    if (renderFreshLater && renderFreshLater[0] === name) {
      coreApi.renderFresh.apply(null, renderFreshLater);
    };
    // TODO, figure out displaying the first definition
    //firstDefinition = holder.selectAll('.data-name option').empty();
    //holder.select('.data-name').append('option')
    //    .attr('value', dataName)
    //    .text(dataName);
    //if (firstDefinition) {
    //  uiApi.changeDataName(dataName);
    //}
  };

  binfo.setup = function(_, width) {
    binfo.width = width;
    holder = d3.select(_);
    uiApi.setup(holder, width);
    renderingApi.setHolder(holder);
  };

  coreApi.dataName = function(_) {
    if (!arguments.length) return dataName;
    if (_ === dataName) return;
    needsToUpdate = true;
    nextDataName = _;
    nextCharts = dataSets[nextDataName].charts;
    nextChartIds = [];
  };

  coreApi.addChart = function(add) {
    coreApi.chartIds(nextChartIds.concat([add]));
  };

  coreApi.clearCharts = function() {
    coreApi.chartIds([]);
  };

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  coreApi.chartIds = function(_) {
    if (!arguments.length) return chartIds;
    nextChartIds = _;
    nextChartIds.forEach(function(id) {
      if (!nextCharts[id]) {
        // Must be a compare chart
        nextCharts[id] = chartsApi.compareChart({id: id, charts: nextCharts});
      }
    });
    removedIds = arrayDiff(chartIds, nextChartIds);
    addedIds = arrayDiff(nextChartIds, chartIds);
    if (addedIds.length || removedIds.length) {
      needsToUpdate = true;
    }
  };

  binfo.defaultRender = function(dataName, charts, filters) {
    if (!renderFreshLater) {
      coreApi.renderFresh(dataName, charts, filters);
    }
  };

  coreApi.renderFresh = function(dataName, charts, filters) {
    if (!dataSets[dataName]) {
      renderFreshLater = [dataName, charts, filters];
      return;
    }
    coreApi.dataName(dataName);
    coreApi.chartIds(charts);
    var id;
    for (id in filters) {
      if (filters.hasOwnProperty(id)) {
        nextCharts[id].filter(filters[id]);
      }
    }
    coreApi.update('force');
  };

  coreApi.updateMode = function(_) {
    if (!arguments.length) return updateMode;
    updateMode = _;
  };

  coreApi.update = function(mode) {
    if (!mode) mode = updateMode;
    if (!needsToUpdate && mode !== 'force') return;
    if (mode === 'manual') {
      uiApi.needsUpdate(true);
      return;
    }
    if (!cross || nextDataName !== dataName ||
        removedIds.length || addedIds.length) {
      if (mode === 'smart') {
        uiApi.needsUpdate(true);
        return;
      }
      if (!updating) {
        updating = true;
        uiApi.updating(true);
        setTimeout(function() { coreApi.update(mode); }, 30);
        return;
      }
    }
    var data = dataSets[nextDataName].data;
    if (!cross || nextDataName !== dataName || removedIds.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      renderingApi.setCross(cross, crossAll, nextDataName);
      addedIds = nextChartIds;
      removedIds = chartIds;
    }
    removedIds.forEach(function(id) { charts[id].remove(); });
    addedIds.forEach(function(id) { nextCharts[id].add(cross, crossAll); });
    dataName = nextDataName;
    charts = nextCharts;
    chartIds = nextChartIds;
    renderingApi.render(charts, chartIds);
    updating = false;
    uiApi.updating(false);
    uiApi.needsUpdate(false);
  };

  coreApi.refresh = function() {
    renderingApi.refresh();
  };
});


binfo._register('rendering', ['core'], function(renderingApi, coreApi) {

  "use strict";

  var holder,
      chartSelection,
      cross,
      crossAll,
      dataName,
      charts,
      chartIds,
      formatNumber = d3.format(',d');

  renderingApi.setHolder = function(_) { holder = _; };

  renderingApi.setCross = function(_, all, name) {
    cross = _;
    crossAll = all;
    dataName = name;  // TODO, possibly remove this.
  };

  renderingApi.render = function(_, ids) {

    charts = _;
    chartIds = ids;

    var chartsHolder = holder.select('.charts'),
        chartData;

    chartData = chartIds.map(function(id, i) {
      return {chart: charts[id]};
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

    holder.select('.total')
        .text(formatNumber(cross.size()) + ' ' + dataName + ' selected.');

    renderingApi.refresh();

    arrangeCharts();
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
    chartIds.forEach(function(id) {
      var chart = charts[id],
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

  renderingApi.refresh = function() {
    renderAll();
    updateHash();
  };


  var currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false;

  function updateHash() {
    var filters = {},
        id,
        filterData,
        chartString = 'charts=' + chartIds.join(','),
        filterString = 'filters=',
        filterArray = [];

    function filterEncode(d) {
      if (typeof d === 'object') {
        d = d.valueOf();
      }
      return encodeURIComponent(d);
    }
    chartIds.forEach(function(id) { charts[id].addToFilters(filters); });
    for (id in filters) {
      if (filters.hasOwnProperty(id) && filters[id]) {
        filterData = filters[id].map(filterEncode).join('*');
        filterArray.push(id + '*' + filterData);
      }
    }
    filterString += filterArray.join(',');
    var params = ['data=' + dataName, chartString, filterString].join('&');
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

  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      d3.select(this).each(chartData.chart[name]);
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('resetUpdate');

  function renderAll() {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(crossAll.value()));
  }

});

