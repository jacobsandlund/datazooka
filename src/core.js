
define('binfo/config', function(require, exports, module) {
  module.exports = {
    numGroups: 35,
    tickSpacing: 46,
    compareHeightScale: 0.20,
    chartHeight: 200,
    chartPadding: 5,
    chartBorder: 5,
    maxLevels: 50,
    arrangeSnap: 40,
    arrangeInsertFocalDiff: 550,
    arrangeInsertMaxDiff: 50,
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
});


define('binfo', function(require, binfo) {

  var core = require('binfo/core'),
      definitions = {},
      data = {},
      untypedData = {};

  binfo.setup = core.setup;
  binfo.defaultRender = core.defaultRender;

  binfo.definitionsFromJSON = function(dataName, defns) {
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
    binfo.definitions(dataName, defns);
  };

  binfo.definitions = function(dataName, defns) {
    var id;
    for (id in defns) {
      if (defns.hasOwnProperty(id)) {
        defns[id].id = id;
        defns[id].type = defns[id].type || 'number';
      }
    }
    definitions[dataName] = defns;
    if (untypedData[dataName]) {
      binfo.dataFromUntyped(dataName, untypedData[dataName]);
    } else {
      checkLoaded(dataName);
    }
  };

  binfo.dataFromUntyped = function(dataName, data) {
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
    binfo.data(dataName, data);
  };

  binfo.data = function(dataName, _) {
    data[dataName] = _;
    checkLoaded(dataName);
  };

  function checkLoaded(name) {
    if (definitions[name] && data[name]) {
      core.dataSet(name, definitions[name], data[name]);
    }
  }

  window.binfo = binfo;

});



define('binfo/core', function(require, core) {

  var ui = require('./ui'),
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

  core.isMouseOut = function() {
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

  core.setup = function(setup) {
    var outer = d3.select(setup.holder).attr('class', 'outer-holder'),
        holder = outer.append('div'),
        root = d3.select(setup.root);
    ui.setup(holder);
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

  core.reorder = function(reorder) {
    chartIds = reorder;
  };

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  core.charts = function() { return charts; };

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

  core.defaultRender = function(dataName, charts, filters) {
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

