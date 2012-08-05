
var binfo = {
  numGroups: 35,
  tickSpacing: 46,
  compareHeightScale: 0.20,
  chartHeight: 200,
  chartPadding: 5,
  chartBorder: 5,
  maxLevels: 50,
  arrangeSnap: 75,
  holderMargin: 15,
  compareLevels: 100,
  axisTickSize: 12,
  axisLabelSize: 14,
  fitWidthMaxDiff: 220,
  chartDimensions: {
    top: 16,
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
      stylesheet = core.dependency('stylesheet'),
      dataSets = {},
      cross,
      crossAll,
      updateMode = 'always',
      smartTimer = null,
      renderFreshLater,
      renderFreshParams,
      renderFresh,
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

  core.isMouseOut = function() {
    var e = d3.event,
        tgt = e.currentTarget,
        related;
    // Taken from quirksmode
    related = e.relatedTarget;
    if (related) {
      while (related !== tgt && related.nodeName !== 'BODY') {
        related = related.parentNode;
      }
      if (related === tgt) {
        return false;
      }
    }
    return true;
  };

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
    ui.addDataName(name);
    if (renderFreshLater && renderFreshLater[0] === name) {
      core.renderFresh.apply(null, renderFreshLater);
    };
  };

  binfo.setup = function(setup) {
    var outer = d3.select(setup.holder).attr('class', 'outer-holder'),
        holder = outer.append('div'),
        root = d3.select(setup.root),
        header = d3.select(setup.header);
    ui.setup(holder, header);
    arrange.setup(root, outer, holder);
    stylesheet.setup(holder);
    root.on('mousemove.core', function() {
      if (smartTimer !== null) {
        clearSmartTimer();
        startSmartTimer();
      }
    });
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
    if (nextChartIds.indexOf(add) >= 0) {
      return;
    }
    core.chartIds(nextChartIds.concat([add]));
    core.update();
  };

  core.removeChart = function(remove) {
    var ids = nextChartIds.slice();
    ids.splice(ids.indexOf(remove), 1);
    core.chartIds(ids);
    core.update();
  };

  core.changeDataName = function(name) {
    core.dataName(name);
    core.update();
  };

  core.clearCharts = function() {
    core.chartIds([]);
    core.update();
  };

  core.cancel = function() {
    nextDataName = dataName;
    nextCharts = charts;
    nextChartIds = chartIds;
    doneUpdating();
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

  core.renderFresh = function(name, ids, params) {
    if (!dataSets[name]) {
      renderFreshLater = [name, ids, params];
      return;
    }
    core.dataName(name);
    core.chartIds(ids);
    renderFresh = true;
    renderFreshParams = params || {filters: {}, given: {}, filterLevels: {}};
    core.update('force');
  };

  core.updateMode = function(_) {
    if (!arguments.length) return updateMode;
    updateMode = _;
  };

  function clearSmartTimer() {
    if (smartTimer !== null) {
      clearTimeout(smartTimer);
      smartTimer = null;
    }
  }

  function startSmartTimer() {
    smartTimer = setTimeout(function() {
      core.update('always');
    }, 700);
  }

  core.update = function(mode) {
    if (!mode) mode = updateMode;
    if (!needsToUpdate && mode !== 'force') return;
    if (mode === 'manual') {
      ui.needsUpdate(true);
      return;
    }
    clearSmartTimer();
    if (!cross || nextDataName !== dataName ||
        removedIds.length || addedIds.length) {
      if (mode === 'smart') {
        ui.needsUpdate(true);
        startSmartTimer();
        return;
      }
      if (!updating) {
        updating = true;
        ui.updating(true);
        setTimeout(function() { core.update(mode); }, 30);
        return;
      }
    }
    hash.disable();
    var data = dataSets[nextDataName].data,
        addedCross = addedIds,
        removedCross = removedIds;
    if (!cross || nextDataName !== dataName || removedIds.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      addedCross = nextChartIds;
      removedCross = chartIds;
      if (!removedIds.length) {
        addedIds = addedCross;
        removedIds = removedCross;
      }
    }
    if (renderFresh) {
      addedIds = nextChartIds;
      removedIds = chartIds;
    }
    removedCross.forEach(function(id) { charts[id].removeCross(); });
    addedCross.forEach(function(id) { nextCharts[id].addCross(cross, crossAll); });
    removedIds.forEach(function(id) { charts[id].remove(); });
    addedIds.forEach(function(id) { nextCharts[id].add(); });

    rendering.render(nextChartIds, nextCharts);
    if (renderFresh) {
      doRenderFresh();
    }
    rendering.refresh(crossAll.value(), cross.size());

    arrange.remove(removedIds, charts);
    arrange.add(addedIds, nextCharts);

    dataName = nextDataName;
    charts = nextCharts;
    chartIds = nextChartIds;

    hash.refresh(dataName, chartIds, charts);
    doneUpdating();
  };

  function doRenderFresh() {
    applyParam(renderFreshParams, 'filter');
    applyParam(renderFreshParams, 'given');
    applyParam(renderFreshParams, 'filterLevels');
    renderFreshParams = null;
    renderFresh = false;
  }

  function applyParam(params, name) {
    var id,
        param = params[name];
    for (id in param) {
      if (param.hasOwnProperty(id)) {
        nextCharts[id][name](param[id]);
      }
    }
  }

  function doneUpdating() {
    updating = false;
    needsToUpdate = false;
    ui.updated(dataName);
  };

  core.refresh = function() {
    rendering.refresh(crossAll.value(), cross.size());
    hash.refresh(dataName, chartIds, charts);
  };
});

