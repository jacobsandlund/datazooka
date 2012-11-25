
define('core', function(require, exports) {

  var crossfilter = require('crossfilter'),
      d3 = require('d3'),
      ui = require('./ui'),
      rendering = require('./rendering'),
      chartsApi = require('./charts'),
      hash = require('./hash'),
      arrange = require('./arrange'),
      stylesheet = require('./stylesheet'),
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

  exports.isMouseOut = function() {
    var e = d3.event,
        tgt = e.currentTarget,
        related;
    // Taken from quirksmode
    related = e.relatedTarget;
    if (related) {
      while (related !== tgt && related.nodeName !== 'BODY' && related.parentNode) {
        related = related.parentNode;
      }
      if (related === tgt) {
        return false;
      }
    }
    return true;
  };

  exports.dataSet = function(name, definitions, data) {
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
      exports.renderFresh.apply(null, renderFreshLater);
    };
  };

  exports.setup = function(setup) {
    var outer = d3.select(setup.holder).attr('class', 'outer-holder'),
        holder = outer.append('div'),
        root = d3.select(setup.root);
    ui.setup(holder);
    arrange.setup(root, outer, holder);
    stylesheet.setup(holder);
    root.on('mousemove.exports', function() {
      if (smartTimer !== null) {
        clearSmartTimer();
        startSmartTimer();
      }
    });
  };

  exports.dataName = function(_) {
    if (!arguments.length) return dataName;
    if (_ === dataName) return;
    needsToUpdate = true;
    nextDataName = _;
    nextCharts = dataSets[nextDataName].charts;
    nextChartIds = [];
  };

  exports.addChart = function(add) {
    if (nextChartIds.indexOf(add) >= 0) {
      return;
    }
    exports.chartIds(nextChartIds.concat([add]));
    exports.update();
  };

  exports.removeChart = function(remove) {
    var ids = nextChartIds.slice();
    ids.splice(ids.indexOf(remove), 1);
    exports.chartIds(ids);
    exports.update();
  };

  exports.changeDataName = function(name) {
    exports.dataName(name);
    exports.update();
  };

  exports.clearCharts = function() {
    exports.chartIds([]);
    exports.update();
  };

  exports.cancel = function() {
    nextDataName = dataName;
    nextCharts = charts;
    nextChartIds = chartIds;
    doneUpdating();
  };

  exports.reorder = function(reorder) {
    chartIds = reorder;
  };

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  exports.charts = function() { return charts; };

  exports.chartIds = function(_) {
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

  exports.defaultRender = function(dataName, charts, filters) {
    if (!renderFreshLater) {
      exports.renderFresh(dataName, charts, filters);
    }
  };

  exports.renderFresh = function(name, ids, params) {
    if (!dataSets[name]) {
      renderFreshLater = [name, ids, params];
      return;
    }
    exports.dataName(name);
    exports.chartIds(ids);
    renderFresh = true;
    renderFreshParams = params || {filters: {}, given: {}, filterLevels: {}};
    exports.update('force');
  };

  exports.updateMode = function(_) {
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
      exports.update('always');
    }, 700);
  }

  exports.update = function(mode) {
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
        setTimeout(function() { exports.update(mode); }, 30);
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

  exports.refresh = function() {
    rendering.refresh(crossAll.value(), cross.size());
    hash.refresh(dataName, chartIds, charts);
  };

});

