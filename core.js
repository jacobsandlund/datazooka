
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


binfo._register('core', [], function(core) {

  var ui = core.dependency('ui'),
      rendering = core.dependency('rendering'),
      chartsApi = core.dependency('charts'),
      hash = core.dependency('hash'),
      arrange = core.dependency('arrange'),
      getHolders = [],
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

  core.dataSet = function(name, definitions, data) {
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
      core.renderFresh.apply(null, renderFreshLater);
    };
    // TODO, figure out displaying the first definition
    //firstDefinition = holder.selectAll('.data-name option').empty();
    //holder.select('.data-name').append('option')
    //    .attr('value', dataName)
    //    .text(dataName);
    //if (firstDefinition) {
    //  ui.changeDataName(dataName);
    //}
  };

  binfo.setup = function(_, width) {
    binfo.width = width;
    holder = d3.select(_);
    ui.setup(holder, width);
    getHolders.forEach(function(g) { g(holder); });
  };

  core.getHolder = function(get) {
    getHolders.push(get);
  };

  core.dataName = function(_) {
    if (!arguments.length) return dataName;
    if (_ === dataName) return;
    needsToUpdate = true;
    nextDataName = _;
    nextCharts = dataSets[nextDataName].charts;
    nextChartIds = [];
  };

  core.addChart = function(add) {
    core.chartIds(nextChartIds.concat([add]));
  };

  core.clearCharts = function() {
    core.chartIds([]);
  };

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  core.chartIds = function(_) {
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
      core.renderFresh(dataName, charts, filters);
    }
  };

  core.renderFresh = function(dataName, charts, filters) {
    if (!dataSets[dataName]) {
      renderFreshLater = [dataName, charts, filters];
      return;
    }
    core.dataName(dataName);
    core.chartIds(charts);
    var id;
    for (id in filters) {
      if (filters.hasOwnProperty(id)) {
        nextCharts[id].filter(filters[id]);
      }
    }
    core.update('force');
  };

  core.updateMode = function(_) {
    if (!arguments.length) return updateMode;
    updateMode = _;
  };

  core.update = function(mode) {
    if (!mode) mode = updateMode;
    if (!needsToUpdate && mode !== 'force') return;
    if (mode === 'manual') {
      ui.needsUpdate(true);
      return;
    }
    if (!cross || nextDataName !== dataName ||
        removedIds.length || addedIds.length) {
      if (mode === 'smart') {
        ui.needsUpdate(true);
        return;
      }
      if (!updating) {
        updating = true;
        ui.updating(true);
        setTimeout(function() { core.update(mode); }, 30);
        return;
      }
    }
    var data = dataSets[nextDataName].data;
    if (!cross || nextDataName !== dataName || removedIds.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      rendering.setCross(cross, crossAll, nextDataName);
      addedIds = nextChartIds;
      removedIds = chartIds;
    }
    removedIds.forEach(function(id) { charts[id].remove(); });
    addedIds.forEach(function(id) { nextCharts[id].add(cross, crossAll); });
    dataName = nextDataName;
    charts = nextCharts;
    chartIds = nextChartIds;
    rendering.render(charts, chartIds);
    rendering.renderTotal(cross.size(), dataName);
    core.refresh();
    arrange.arrange(charts, chartIds);
    updating = false;
    ui.updating(false);
    ui.needsUpdate(false);
  };

  core.refresh = function() {
    rendering.refresh(crossAll);
    hash.refresh(dataName, charts, chartIds);
  };
});

