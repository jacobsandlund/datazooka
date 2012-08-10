
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


binfo._register('arrange', ['core'], function(arrange, core) {

  var outer,
      holder,
      maxLevel,
      reordered,
      arranging,
      ghost,
      positioner,
      holderNode,
      root,
      zIndex = 1,
      layout;

  arrange.setup = function(r, o, h) {
    root = r;
    outer = o;
    holder = h;
    holderNode = holder.node();
    ghost = holder.append('div')
        .attr('class', 'ghost')
        .style('display', 'none');
    ghost.div = ghost;
    positioner = holder.append('div')
        .attr('class', 'positioner')
        .style('display', 'none');
    positioner.div = positioner;
    maxLevel = 0;
    layout = [];
    var dummyChart = {left: binfo.holderMargin, width: 0, levels: 0},
        i;
    for (i = 0; i < binfo.maxLevels; i++) {
      layout[i] = [dummyChart];
    }
    root.on('mousemove.arrange', function() {
      var coords = mouseCoords();
      if (arranging) {
        drag.apply(null, coords);
      }
    });
    root.on('mouseup.arrange', function() {
      if (arranging) {
        arrangeEnd();
      }
    });
  };

  arrange.start = function(chart) {
    var coords = mouseCoords();
    root.node().onselectstart = function() { return false; };
    zIndex += 1;
    chart.div.style('z-index', zIndex);
    ghost.width = chart.width;
    ghost.height = chart.height - binfo.chartBorder / 2;
    ghost.left = chart.left;
    ghost.top = chart.top;
    positioner.height = chart.height + binfo.chartBorder;
    ghost.levels = chart.levels;
    ghost
        .style('display', 'block')
        .style('width', ghost.width + 'px')
        .style('height', ghost.height + 'px');
    reposition(ghost);
    positioner
        .style('display', 'block')
        .style('height', positioner.height + 'px');
    whereToSnap(chart);
    chart.div.classed('arranging', true);
    arranging = {
      chart: chart,
      offsetX: coords[0] - chart.left,
      offsetY: coords[1] - chart.top
    };
  };

  function arrangeEnd() {
    var chart = arranging.chart;
    ghost.style('display', 'none');
    positioner.style('display', 'none');
    chart.div.classed('arranging', false);
    root.node().onselectstart = function() { return true; };
    arranging = null;
  }

  function mouseCoords() {
    var coords = d3.mouse(holderNode),
        x = coords[0] + holderNode.scrollLeft,
        y = coords[1] + holderNode.scrollTop;
    return [x, y];
  }

  function drag(x, y) {
    var chart = arranging.chart,
        offsetX = arranging.offsetX,
        offsetY = arranging.offsetY,
        diffX,
        diffY,
        abs = Math.abs,
        snapDiff = binfo.arrangeSnap;
    ghost.left = x - offsetX;
    ghost.top = y - offsetY;
    reposition(ghost);
    diffX = positioner.left - ghost.left;
    diffY = positioner.top - ghost.top;
    if (chart.snapped) {
      if (abs(diffX) > snapDiff || abs(diffY) > snapDiff) {
        remove(chart);
      }
    }
    if (!chart.snapped) {
      chart.left = ghost.left;
      chart.top = ghost.top;
      reposition(chart);
      maybeSnap(chart);
    }
    reordered = true;
  };

  function whereToSnap(chart) {
    var level = Math.round(ghost.top / binfo.chartHeight),
        bestEdge,
        bestDiff = 1e10;
    if (level < 0) {
      level = 0;
    }
    if (level >= layout.length) {
      level = layout.length - 1;
    }
    forEdgesAtLevels(level, chart.levels, function(edge) {
      var diff = Math.abs(edge - ghost.left);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEdge = edge;
      }
    });
    snapPosition(positioner, bestEdge, level);
    return {level: level, left: bestEdge, diff: bestDiff};
  }

  function maybeSnap(chart) {
    var snap = whereToSnap(chart),
        level = snap.level,
        left = snap.left,
        diff = snap.diff;
    if (Math.abs(level * binfo.chartHeight - ghost.top) >= binfo.arrangeSnap) {
      return;
    }
    if (diff >= binfo.arrangeSnap) {
      return;
    }

    var addAt = null;
    forEdgesAtLevels(level, chart.levels, function(edge, i) {
      if (edge > left && addAt === null) {
        addAt = i;
      }
    }, function(row) {
      if (addAt === null) {
        addAt = row.length;
      }
      row.splice(addAt, 0, chart);
      addAt = null;
    });
    setMaxLevel();
    setSnapped(chart, true);
    snapPosition(chart, left, level);
    checkAllMoveAtChart(chart);
  }

  function forEdgesAtLevels(level, levels, rowCallback, levelCallback) {
    var i,
        row,
        j,
        edge;
    for (i = level; i < level + levels; i++) {
      row = layout[i];
      for (j = 0; j < row.length; j++) {
        edge = row[j].left + row[j].width;
        rowCallback(edge, j);
      }
      if (levelCallback) {
        levelCallback(row);
      }
    }
  }

  arrange.remove = function(removed, charts) {
    removed.forEach(function(id) { remove(charts[id]); });
    setMaxLevel();
    reordered = true;
  };

  function setMaxLevel() {
    var i,
        row,
        max = 0;
    for (i = 0; i < layout.length; i++) {
      if (layout[i].length > 1) {
        max = i;
      }
    }
    row = layout[max];
    maxLevel = 0;
    for (i = 1; i < row.length; i++) {
      maxLevel = Math.max(maxLevel, row[i].startLevel);
    }
  }

  function forRowAtChart(chart, callback) {
    var row,
        i,
        j;
    for (i = chart.startLevel; i < chart.startLevel + chart.levels; i++) {
      row = layout[i];
      for (j = 1; j < row.length; j++) {
        if (row[j] === chart) {
          callback(row, j);
          break;
        }
      }
    }
  }

  function checkAtChart(chart) {
    var check = [];
    forRowAtChart(chart, function(row, i) {
      var next = row[i + 1];
      if (next) {
        if (check.indexOf(next) < 0) {
          check.push(next);
        }
      }
    });
    return check;
  }

  function remove(chart) {
    var check = checkAtChart(chart);
    forRowAtChart(chart, function(row, i) { row.splice(i, 1); });
    setSnapped(chart, false);
    checkAllMove(check);
  }

  function checkAllMove(check) {
    check.forEach(function(c) { checkMove(c); });
  }

  function checkAllMoveAtChart(chart) {
    checkAllMove(checkAtChart(chart));
  }

  function checkMove(chart) {
    var left = 0;
    forRowAtChart(chart, function(row, i) {
      left = Math.max(left, row[i - 1].left + row[i - 1].width);
    });
    if (left !== chart.left) {
      chart.left = left;
      reposition(chart);
      checkAllMoveAtChart(chart);
    }
  }

  function snapPosition(chart, left, level) {
    chart.left = left;
    chart.startLevel = level;
    chart.top = level * binfo.chartHeight;
    reposition(chart);
  }

  function setSnapped(chart, snap) {
    chart.snapped = snap
    chart.div.classed('unsnapped', !snap);
    positioner.style('border-color', snap ? '#eee' : 'red');
  }

  function reposition(chart) {
    chart.div
        .style('left', chart.left + 'px')
        .style('top', chart.top + 'px');
  }

  arrange.add = function(added, charts) {
    var maxWidth = window.innerWidth - binfo.holderMargin - binfo.chartBorder;
    added.forEach(function(id) {
      var chart = charts[id],
          levels = chart.levels,
          width = chart.width,
          row,
          left,
          remaining,
          otherChart,
          fitting = 0,
          fitWidth,
          fitWidthDiff,
          startLevel,
          direction = -1,
          i = maxLevel,
          j;
      while (i < layout.length) {
        row = layout[i];
        otherChart = row[row.length - 1];
        left = otherChart.left + otherChart.width;
        remaining = maxWidth - left;
        if (remaining >= width || row.length === 1) {
          if (fitting) {
            fitWidthDiff = Math.abs(remaining - fitWidth);
            if (fitWidthDiff <= binfo.fitWidthMaxDiff) {
              fitting += 1;
              fitWidth = Math.min(remaining, fitWidth);
            } else {
              fitWidth = remaining;
              fitting = 1;
            }
          } else {
            fitWidth = remaining;
            fitting = 1;
          }
        } else {
          fitting = 0;
        }
        if (fitting === levels) {
          break;
        }
        if (i === 0 && direction === -1) {
          direction = 1;
          i = maxLevel - levels;
          if (i < 0) {
            i = -1;
          }
          fitting = 0;
        }
        i += direction;
      }
      startLevel = (direction === 1) ? i - levels + 1 : i;
      for (j = startLevel; j < startLevel + levels; j++) {
        layout[j].push(chart);
      }
      maxLevel = Math.max(startLevel, maxLevel);
      setSnapped(chart, true);
      snapPosition(chart, maxWidth - fitWidth, startLevel);
    });

    setMaxLevel();
    reordered = true;
  };

  // Also adds height to holder
  arrange.orderedChartIds = function() {
    if (!reordered) return null;
    var chartIds = core.chartIds(),
        charts = core.charts(),
        ordered,
        orderedIds,
        newChartIds = [];
    ordered = chartIds.map(function(id) { return charts[id]; });
    ordered.sort(function(a, b) {
      if (a.top === b.top) {
        return a.left - b.left;
      }
      return a.top - b.top;
    });
    var last = ordered[ordered.length - 1],
        max = last ? last.top + last.height : 0,
        holderHeight = max + 820;
    holder.style('height', holderHeight + 'px');
    outer.style('height', (holderHeight + 30) + 'px');
    reordered = false;
    orderedIds = ordered.map(function(chart) { return chart.id; });
    core.reorder(orderedIds);
    return orderedIds;
  };

});



binfo._register('charts', ['core', 'logic', 'arrange'],
                function(charts, core, logic, arrange) {

  "use strict";

  charts.barChart = function(spec, data) {
    var bar = {api: {}};
    logic.barLogic(bar, spec, data);
    barChart(bar, spec);
    return bar.api;
  };

  charts.compareChart = function(spec) {
    var compare = {api: {}};
    logic.compareLogic(compare, spec);
    compareChart(compare, spec);
    return compare.api;
  };


  function findTextWidth(text, size) {
    if (typeof size === 'number') size += 'px';
    var span = d3.select('.holder').append('span')
        .style('font-size', size)
        .text(text);
    var width = span.property('offsetWidth');
    span.remove();
    return Math.ceil(width);
  }

  function findDim(spec) {
    var dim = spec.dimensions || {},
        defaultDim = binfo.chartDimensions,
        dimName;
    for (dimName in defaultDim) {
      if (defaultDim.hasOwnProperty(dimName)) {
        if (!dim[dimName]) {
          dim[dimName] = defaultDim[dimName];
        }
      }
    }
    return dim;
  }

  function findBaseDim(dim) {
    var base = {};
    base.left = dim.left;
    base.right = dim.right;
    base.bottom = dim.bottom;
    base.top = dim.top;
    return base;
  }


  function baseSetupChart(div, api) {
    api.div = div;
    var title = div.select('.title')
        .text(api.label)
        .style('display', 'none');  // hide title until width is figured out
    div.append('div')
        .attr('class', 'remove')
        .html('&#10006;')
        .on('click', function() { core.removeChart(api.id); });
    div.on('mousedown', function() {
      var tgt = d3.event.target;
      if (tgt !== div.node() && tgt !== title.node()) return;
      arrange.start(api);
    });
  }

  function baseSetupSvg(div, setupDim, orientFlip) {
    var height = setupDim.actualHeight || setupDim.height,
        fullWidth = setupDim.left + setupDim.right,
        fullHeight = setupDim.top + setupDim.bottom;
    if (orientFlip) {
      fullWidth += height;
      fullHeight += setupDim.width;
    } else {
      fullWidth += setupDim.width;
      fullHeight += height;
    }
    var g = div.append('svg')
        .attr('width', fullWidth)
        .attr('height', fullHeight)
      .append('g')
        .attr('transform', 'translate(' + setupDim.left + ',' +
                                          setupDim.top + ')');
    if (orientFlip) {
      g   .attr('transform', 'matrix(0,1,-1,0,' + (setupDim.actualHeight +
                              setupDim.left) + ',' + setupDim.top + ')');
    }

    return g;
  }

  function baseArrange(div, api) {
    var width = div.property('offsetWidth') - binfo.chartBorder,
        innerWidth = width - binfo.chartPadding * 2 - binfo.chartBorder,
        height,
        levels;
    api.width = width;
    div.style('width', innerWidth + 'px');
    div.select('.title')
        .style('width', (innerWidth - 15) + 'px')   // 15 for Remove 'x'
        .style('display', null);
    height = div.property('offsetHeight') - binfo.chartBorder - 5;
    levels = Math.ceil(height / binfo.chartHeight);
    api.levels = levels;
    api.height = levels * binfo.chartHeight;
    height = api.height - (binfo.chartBorder + 2 * binfo.chartPadding);
    api.snapped = false;
    div.style('height', height + 'px');
  }

  function activateBrush(brush, filter, round) {
    brush.on('brush', function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (round) {
        if (extent && Array.isArray(extent[0])) {
          extent = extent.map(function(e) { return e.map(round); });
        } else {
          extent = extent.map(round);
        }
        g.select('.brush')
            .call(brush.extent(extent));
      }
      if (!brush.empty()) {
        filter(extent);
      }
    });

    brush.on('brushend', function() {
      if (brush.empty()) {
        filter(null);
      }
    });
  }

  function resizePath(d, height) {
    height = height || 30;
    var e = +(d === 'e'),
        x = e ? 1 : -1,
        h = Math.min(height, 30),
        y = height / 2 - h / 2;
    return 'M' + (0.5 * x) + ',' + y +
            'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6) +
            'V' + (y + h - 6) +
            'A6,6 0 0 ' + e + ' ' + (0.5 * x) + ',' + (y + h) +
            'Z' +
            'M' + (2.5 * x) + ',' + (y + h / 4) +
            'V' + (y + h - h / 4) +
            'M' + (4.5 * x) + ',' + (y + h / 4) +
            'V' + (y + h - h / 4);
  }

  function addBrush(parent, brush, height) {
    var gBrush = parent.append('g').attr('class', 'brush').call(brush);
    if (height) {
      gBrush.selectAll('rect').attr('height', height);
    }
    var resize = height ? resizePath : function() { return 'M0,0'; };
    gBrush.selectAll('.resize').append('path').attr('d', function(d) {
      return resize(d, height);
    });
    return gBrush;
  }


  var percentFmt = d3.format('.3p');

  var clipId = 0;

  function barChart(bar, spec) {

    var dim = findDim(spec),
        baseDim = findBaseDim(dim),
        defaultOrientFlip = false,
        compareHeightScale = spec.compareHeightScale || binfo.compareHeightScale,
        x = spec.x,
        y = spec.y || d3.scale.linear().range([dim.height, 0]),
        tickSpacing = spec.tickSpacing || binfo.tickSpacing,
        ticks = spec.ticks,
        axis = d3.svg.axis(),
        brush = d3.svg.brush(),
        path,
        brushDirty;

    if (spec.tickSpacing === false) {
      tickSpacing = false;
    }

    dim.compareHeight = dim.height * compareHeightScale;
    if (bar.ordinal) {
      defaultOrientFlip = true;
    }

    bar.api.label = spec.label;
    bar.api.defaultOrientFlip = defaultOrientFlip;
    bar.api.dim = dim;

    dim.labelWidth = findTextWidth(bar.api.label, binfo.axisLabelSize);

    function filter(range) {
      bar.api.filter(range);
      core.refresh();
    }

    activateBrush(brush, filter, bar.round);

    bar.updateChart = function() {
      var groups = bar.rawGroups(),
          pathParts = [],
          i = -1,
          n = groups.length,
          height = dim.height,
          bWidth = dim.binWidth - 1,
          d;
      y.domain([0, bar.maxY()]);
      while (++i < n) {
        d = groups[i];
        pathParts.push('M', x(d.key), ',', height, 'V', y(d.value),
                        'h', bWidth, 'V', height);
      }
      path = pathParts.join('');
    };

    bar.api.render = function() {
      /*jshint validthis:true */
      var root = d3.select(this),
          g,
          div,
          setupDim,
          data = root.datum(),
          orientFlip = data.orientFlip,
          compare = data.compare,
          checkSelection,
          i;

      if (typeof orientFlip === 'undefined') orientFlip = defaultOrientFlip;

      if (compare) {
        g = root;
        checkSelection = g.select('path');
      } else {
        div = root;
        g = div.select('g');
        checkSelection = g;
      }

      if (checkSelection.empty()) {
        if (orientFlip) {
          setupDim = {
            top: dim.left,
            right: dim.top,
            bottom: dim.right,
            left: dim.bottom,
          };
        } else {
          setupDim = {};
        }
        for (i in dim) {
          if (dim.hasOwnProperty(i) && typeof setupDim[i] === 'undefined') {
            setupDim[i] = dim[i];
          }
        }
        if (orientFlip && !bar.ordinal) {
          setupDim.left = baseDim.left + dim.maxTickWidth;
        }
        setupDim.actualHeight = compare ? setupDim.compareHeight : setupDim.height;

        if (!compare) {
          baseSetupChart(div, bar.api);
          g = baseSetupSvg(div, setupDim, orientFlip);
        }
        setupChart(g, setupDim, data);
        if (!compare) {
          setupChartPeripherals(div, setupDim);
          baseArrange(div, bar.api);
        }
      }

      renderUpdate(div, g, data);
    };


    function setupChart(g, setupDim, data) {

      var orientFlip = data.orientFlip,
          compare = data.compare,
          axisHolder,
          gPaths;

      if (typeof orientFlip === 'undefined') orientFlip = defaultOrientFlip;

      gPaths = g.append('g');
      if (compare) {
        gPaths.attr('transform', 'scale(1,' + compareHeightScale + ')');
      }

      // A different clipId for each chart
      clipId += 1;
      gPaths.append('clipPath')
          .attr('id', 'clip-' + clipId)
          .attr('class', 'clip-' + bar.api.id)
        .append('rect')
          .attr('width', setupDim.width)
          .attr('height', setupDim.height);

      gPaths.selectAll('.bar')
          .data(['background', 'foreground'])
        .enter().append('path')
          .attr('class', function(d) { return d + ' bar'; });

      gPaths.selectAll('.foreground.bar')
          .attr('clip-path', 'url(#clip-' + clipId + ')');


      axisHolder = g.append('g')
          .attr('class', 'axis');
      if (bar.ordinal) {
        axisHolder
            .attr('transform', 'matrix(0,-1,1,0,0,' + setupDim.actualHeight + ')')
            .classed('ordinal', true);
        axisHolder.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', 0)
            .attr('y2', setupDim.width);
        axisHolder.selectAll('text')
            .data(bar.ordinal())
          .enter().append('text')
            .attr('y', function(d, i) { return (i + 0.9) * setupDim.binWidth; })
            .attr('x', -6)
            .text(function(d) { return d; });
      } else {
        if (orientFlip) {
          axis.orient('left');
          axisHolder
              .attr('transform', 'matrix(0,-1,1,0,0,' + setupDim.actualHeight + ')')
              .call(axis);
        } else {
          axis.orient('bottom');
          axisHolder
              .attr('transform', 'translate(0,' + setupDim.actualHeight + ')')
              .call(axis);
        }
      }

      var gBrush = addBrush(g, brush, setupDim.actualHeight);
      if (orientFlip) {
        gBrush.selectAll('.resize')
            .style('cursor', 'ns-resize');
      }
    }

    function setupChartPeripherals(div, setupDim) {
      var filterButton,
          filterBar = div.append('div').attr('class', 'peripherals filter-bar');
      function toggleActive() {
        var el = d3.select(this);
        if (!bar.filterActive()) {
          filter(true);
        } else {
          filter(null);
        }
      }
      function submitChange() {
        var range = [];
        filterBar.selectAll('.range').each(function() { range.push(this.value); });
        var left = x(range[0]),
            right = x(range[1]);
        if (left <= right && right >= 0 && left <= setupDim.width) {
          filter(range);
        }
        setUpdating(false);
      }
      filterButton = filterBar.append('div')
          .attr('class', 'filter button')
      function setUpdating(updating) {
        if (updating) {
          filterButton
              .classed('down', false)
              .text('Update')
              .on('click', submitChange);
        } else {
          filterButton.on('click', toggleActive);
          filterButtonDown(div);
        }
      }
      setUpdating(false);

      filterBar.selectAll('.range').data(['left', 'right'])
        .enter().append('input')
          .attr('type', 'text')
          .attr('class', function(d) { return 'range ' + d; })
          .property('value', function(d, i) { return bar.filterRange()[i]; })
          .on('keydown', function() {
            if (d3.event.keyCode === 13) {
              submitChange();
            } else {
              setUpdating(true);
            }
          });
    }

    function filterButtonDown(div) {
      var active = bar.filterActive();
      div.select('.filter.button')
          .text(active ? 'Reset' : 'Filter')
          .classed('down', active);
    }

    function renderUpdate(div, g, data) {

      var percentText,
          percent,
          extent,
          compare = data.compare;

      // Only redraw the brush if set externally.
      if (brushDirty) {
        g.selectAll('.brush').call(brush);
        if (!compare) {
          filterButtonDown(div);
          div.selectAll('.range')
              .property('value', function(d, i) { return bar.filterRange()[i]; });
        }
        if (bar.filterActive()) {
          extent = brush.extent();
          g.selectAll('.clip-' + bar.api.id + ' rect')
              .attr('x', x(extent[0]))
              .attr('width', x(extent[1]) - x(extent[0]));
          if (!compare) {
            percentText = g.selectAll('.percent').data([1]);
            percentText.enter().append('text')
                .attr('class', 'percent')
                .attr('y', -4);
            percentText
                .attr('x', (x(extent[1]) + x(extent[0])) / 2);
          }
        } else {
          g.selectAll('.clip-' + bar.api.id + ' rect')
              .attr('x', 0)
              .attr('width', dim.width);
          g.selectAll('.percent').data([]).exit().remove();
        }
      }
      if (!compare) {
        percent = bar.percent();
        percentText = g.selectAll('.percent').text(percentFmt(percent));
      }

      g.selectAll('.bar')
          .attr('d', path);
    }

    bar.addChart = function() {
      var minX = bar.minX(),
          maxX = bar.maxX(),
          tix;

      if (!spec.x) {
        if (spec.type === 'date') {
          x = d3.time.scale();
        } else {
          x = d3.scale.linear();
        }
        x   .domain([minX, maxX])
            .rangeRound([0, bar.api.numGroups() * dim.binWidth]);
      }
      bar.x = x;
      if (!bar.ordinal) {
        axis.scale(x);
        if (spec.format) {
          axis.tickFormat(spec.format);
        }
      }
      brush.x(x);
      dim.width = x.range()[1];
      if (ticks || tickSpacing) {
        tix = bar.ticks || Math.round(dim.width / tickSpacing);
        axis.ticks(tix);
      }

      // Update margin to fit everything
      var maxOrd = 0,
          fmt,
          lowestWidth,
          highestWidth,
          maxTickWidth = 0;
      if (bar.ordinal) {
        bar.ordinal().forEach(function(ord) {
          maxOrd = Math.max(maxOrd, findTextWidth(ord, binfo.axisTickSize));
        });
        dim.bottom = baseDim.bottom + maxOrd;
        dim.maxTickWidth = 0;
      } else {
        fmt = axis.tickFormat() || x.tickFormat();
        tix = axis.tickValues() || x.ticks(tix || binfo.numGroups);
        lowestWidth = findTextWidth(fmt(tix[0]));
        highestWidth = findTextWidth(fmt(tix[tix.length - 1]));
        tix.forEach(function(t) {
          maxTickWidth = Math.max(maxTickWidth, findTextWidth(fmt(t)));
        });
        dim.left = baseDim.left + Math.ceil(lowestWidth / 2);
        dim.right = baseDim.right + Math.ceil(highestWidth / 2);
        dim.maxTickWidth = maxTickWidth;
      }

    };

    bar.chartFilter = function() {
      var range = bar.filterActive() ? bar.filterRange() : null;
      if (range) {
        brush.extent(range);
      } else {
        brush.clear();
      }
      brushDirty = true;
    };


    bar.resetUpdateChart = function() {
      brushDirty = false;
    };

  }



  function compareChart(compare, spec) {

    var dim = findDim(spec),
        baseDim = findBaseDim(dim),
        xc = compare.xc,
        yc = compare.yc,
        brush = d3.svg.brush(),
        bgPath,
        paths = [],
        levels = binfo.compareLevels,
        hoverEnabled = true,
        i,
        filteredLevels,
        levelNums = [];

    compare.api.label = xc.label + ' vs. ' + yc.label;

    for (i = 0; i < levels; i++) {
      levelNums.push(i);
    }

    function filter(range) {
      compare.api.filter(range);
    }

    function hoverEnable(enable) {
      var gCompare = compare.api.div.select('g.compare');
      hoverEnabled = enable;
      if (enable) {
        mouseHover(gCompare);
      } else {
        mouseOut(gCompare);
      }
    }
    activateBrush(brush, filter, compare.round);
    brush.on('brushstart.compare', function() { hoverEnable(false); });
    brush.on('brushend.compare', function() { hoverEnable(true); });

    function given(what) {
      compare.api.given(what);
      core.refresh();
    }

    compare.updateChart = function() {
      var levelsMatrix = compare.levelsMatrix(),
          xn = levelsMatrix.length,
          yn = levelsMatrix[0].length,
          pathParts = [],
          xi,
          yi,
          level,
          bWidth = dim.binWidth,
          x,
          y;
      for (xi = 1; xi < levels; xi++) {
        pathParts[xi] = [];
      }
      pathParts[-1] = pathParts[0] = {
        push: function() {},
        join: function() { return bgPath; }
      };
      for (xi = 0; xi < xn; xi++) {
        x = xi * bWidth;
        for (yi = 0; yi < yn; yi++) {
          y = yi * bWidth;
          level = levelsMatrix[xi][yi];
          pathParts[level].push('M', x, ',', y, 'v', bWidth,
                                'h', bWidth, 'v', -bWidth);
        }
      }
      for (xi = 0; xi < levels; xi++) {
        paths[xi] = pathParts[xi].join('') || 'M0,0';
      }
    };

    compare.api.render = function(div) {
      /*jshint validthis:true */
      var div = d3.select(this),
          g = div.select('g');

      if (g.empty()) {
        baseSetupChart(div, compare.api);
        g = baseSetupSvg(div, dim, false);
        div.select('svg').attr('class', 'compare');
        setupChart(g);
        setupChartPeripherals(div);
        baseArrange(div, compare.api);
      }

      renderUpdate(div, g);
    }

    function setupChart(g) {
      var gCompare;
      g.append('g')
          .attr('class', 'yc inner-chart')
          .datum({compare: true, orientFlip: true})
          .attr('transform', 'matrix(0,1,-1,0,' + dim.yHeight +
                             ',' + dim.yTop + ')');
      g.append('g')
          .attr('class', 'xc inner-chart')
          .attr('transform', 'translate(' + dim.xLeft + ',' + dim.xTop + ')')
          .datum({compare: true, orientFlip: false});
      gCompare = g.append('g')
          .attr('class', 'compare')
          .attr('transform', 'translate(' + dim.xLeft + ',' + dim.yTop + ')')
          .on('mousemove', function() { mouseHover(gCompare); })
          .on('mouseout', function() {
            if (core.isMouseOut()) {
              mouseOut(gCompare);
            }
          });

      gCompare.selectAll('.compare.level')
          .data(levelNums)
        .enter().append('path')
          .attr('class', function(d) { return 'level-' + d + ' compare level'; });

      gCompare.append('text')
          .attr('class', 'compare percent')
          .attr('transform', 'translate(' + (dim.xWidth / 2) + ',-5)');

      gCompare.append('rect')
          .attr('class', 'hover')
          .style('display', 'none');

      addBrush(gCompare, brush);

      g.append('g')
          .attr('transform', 'translate(' + (-dim.left + 7) + ',' +
                              (dim.yWidth / 2) + ') rotate(90)')
        .append('text')
          .attr('class', 'axis-label')
          .text(yc.label);
      g.append('text')
          .attr('x', dim.xLeft + dim.xWidth / 2)
          .attr('y', dim.height + dim.bottom - 8)
          .attr('class', 'axis-label')
          .text(xc.label);

      return g;
    }

    function boxFromCoords(gCompare) {
      var coords = d3.mouse(gCompare.node()),
          xi = coords[0] - 1,
          yi = coords[1] - 1;
      if (xi < 0 || yi < 0) {
        return null;
      }
      xi = Math.floor(xi / dim.binWidth);
      yi = Math.floor(yi / dim.binWidth);
      if (xi >= compare.xcNumGroups() || yi >= compare.ycNumGroups()) {
        return null;
      }
      return {xi: xi, yi: yi};
    }

    function mouseHover(gCompare) {
      if (hoverEnabled) {
        drawHover(gCompare, boxFromCoords(gCompare));
      }
    }

    function mouseOut(gCompare) {
      drawHover(gCompare, null);
    }

    function drawHover(gCompare, hoverBox) {
      var hover = gCompare.select('rect.hover'),
          bWidth = dim.binWidth,
          xi,
          yi;
      hover.style('display', hoverBox ? null : 'none');
      if (!hoverBox) {
        updateFilter();
        return;
      }
      xi = hoverBox.xi;
      yi = hoverBox.yi;
      hover
          .attr('x', xi * bWidth)
          .attr('y', yi * bWidth)
          .attr('width', bWidth)
          .attr('height', bWidth);
      updateFilter(compare.stats([[xi, yi], [xi + 1, yi + 1]]));
    }

    function setupChartPeripherals(div) {
      var legend,
          legendPad,
          leftPad,
          rectWidth,
          rectHeight,
          legendHeight,
          axisWidth,
          legendAxis,
          legendScale,
          legendBrush = d3.svg.brush(),
          givenBar;

      rectWidth = 16,
      rectHeight = 2;
      axisWidth = 30;
      legendPad = 16;
      leftPad = 10;
      legendHeight = levels * rectHeight;

      legendScale = d3.scale.linear()
          .domain([0, 100])
          .range([legendHeight - 1, 0]);
      legendAxis = d3.svg.axis()
          .scale(legendScale)
          .orient('right');

      legendBrush.x(legendScale);

      function filterLevels(range) {
        compare.api.filterLevels(range);
      }

      activateBrush(legendBrush, filterLevels, Math.round);

      legend = div.append('svg')
          .attr('class', 'legend')
          .attr('height', legendHeight + 2 * legendPad)
          .attr('width', rectWidth + axisWidth + leftPad)
        .append('g')
          .attr('transform', 'translate(' + leftPad + ',' + legendPad + ')');
      legend.append('text')
          .attr('class', 'axis-label')
          .attr('x', rectWidth / 2)
          .attr('y', -6)
          .text('Level');
      legend.append('g')
          .attr('transform', 'translate(' + rectWidth + ',0)')
          .attr('class', 'axis')
          .call(legendAxis);
      legend.selectAll('rect.level')
          .data(levelNums)
        .enter().append('rect')
          .attr('class', function(d) { return 'level level-' + d; })
          .attr('x', 0)
          .attr('y', function(d, i) {
            return legendHeight - (i + 1) * rectHeight;
          })
          .attr('width', rectWidth)
          .attr('height', rectHeight);

      var gBrush = addBrush(legend, legendBrush, rectWidth)
          .attr('transform', 'rotate(90) translate(0,' + -rectWidth + ')');
      gBrush.selectAll('.resize')
          .style('cursor', 'ns-resize');

      compare.updateLegend = function(range) {
        if (range) {
          legendBrush.extent(range);
        } else {
          legendBrush.clear();
          range = [0, 100];
        }
        gBrush.call(legendBrush);
        compare.api.div.selectAll('.level').each(function(d) {
          d3.select(this)
              .classed('level-fade-' + d, d < range[0] || d >= range[1]);
        });
      };
      compare.updateLegend(filteredLevels);

      givenBar = div.append('div')
          .attr('class', 'peripherals given-bar')
          .style('width', dim.width + 'px')
          .style('margin-left', (dim.left + dim.xLeft) + 'px');
      givenBar.append('div')
          .attr('class', 'words')
          .text('Given');
      givenBar.append('div')
          .attr('class', 'xc given button');
      givenBar.append('div')
          .attr('class', 'words')
          .text('or');
      givenBar.append('div')
          .attr('class', 'yc given button');
      givenBar.selectAll('.given.button')
          .data(['xc', 'yc'])
          .text(function(d) { return compare[d].label; })
          .classed('down', function(d) { return compare.api.given() === d; })
          .on('click', function(d) {
            var el = d3.select(this);
            if (compare.api.given() === d) {
              given(null);
            } else {
              given(d);
            }
          });
    }

    compare.chartLevels = function(range) {
      filteredLevels = range;
      if (compare.updateLegend) {
        compare.updateLegend(range);
      }
    };

    function renderUpdate(div, g) {
      g.selectAll('.yc.inner-chart').each(yc.render);
      g.selectAll('.xc.inner-chart').each(xc.render);
      g.selectAll('.compare.level')
          .attr('d', function(d) { return paths[d]; });
      div.selectAll('.given.button')
          .classed('down', function(d) { return compare.api.given() === d; });
      updateFilter();
    }

    compare.addChart = function() {
      var over;
      dim.left = yc.dim.bottom + yc.dim.maxTickWidth + 14;
      dim.bottom = xc.dim.bottom + 14 + (xc.ordinal ? 0 : 10);
      dim.xHeight = xc.dim.compareHeight;
      dim.yHeight = yc.dim.compareHeight;
      dim.xWidth = xc.dim.width;
      dim.yWidth = yc.dim.width;
      over = Math.ceil((xc.dim.labelWidth - xc.dim.width) / 2);
      dim.right = Math.max(dim.right, over);
      dim.left = Math.max(dim.left, over - dim.yHeight);
      over = Math.ceil((yc.dim.labelWidth - yc.dim.width) / 2);
      dim.top = Math.max(dim.top, over);
      dim.bottom = Math.max(dim.bottom, over - dim.xHeight);
      dim.xTop = dim.yWidth + 4;
      dim.xLeft = dim.yHeight + 2;
      dim.yTop = 2;
      dim.width = dim.yHeight + dim.xWidth + 4;
      dim.height = dim.yWidth + dim.xHeight + 4;
      dim.actualHeight = dim.height;
      bgPath = 'M-1,-1V' + (dim.xTop - dim.yTop - 2) +
               'H' + (dim.width - dim.xLeft - 2) + 'V-1H-1';

      var xScale = d3.scale.linear()
          .domain([0, compare.xcNumGroups()])
          .range([0, compare.xcNumGroups() * dim.binWidth]);
      var yScale = d3.scale.linear()
          .domain([0, compare.ycNumGroups()])
          .range([0, compare.ycNumGroups() * dim.binWidth]);
      brush.x(xScale).y(yScale);
    };

    compare.api.cleanUp = function() {
    };

    compare.chartFilter = function(range) {
      if (range) {
        brush.extent(range);
      } else {
        brush.clear();
      }
      if (compare.api.div) {
        compare.api.div.selectAll('g.compare .brush').call(brush);
        updateFilter();
      }
    };

    function updateFilter(stats) {
      var gCompare = compare.api.div.select('g.compare'),
          stats = stats || compare.filterStats(),
          text = '';
      if (stats) {
        text = percentFmt(stats.percent) + ' (Lvl: ' + stats.level + ')';
      }
      gCompare.select('text.percent').text(text);
    }

  };
});


binfo._register('logic', ['hash'], function(logic, hash) {

  "use strict";

  logic.barLogic = function(bar, spec, data) {

    var added = 0,
        addedCross = 0,
        updated,
        filterRange,
        filterActive,
        crossAll,
        dimension,
        dimensionFunc,
        internalDimensionFunc,
        group,
        groups,
        rawGroups,
        groupFunc,
        groupAll,
        ordinal = [],
        indexFromOrdinal = {},
        ordinalOrdered,
        ordinalHash = {},
        format,
        minX = spec.minX,
        maxX = spec.maxX,
        maxY = spec.maxY,
        separation = spec.separation;


    bar.api.id = spec.id;
    bar.round = spec.round;

    function groupFuncBy(groupBy) {
      return function(d) { return Math.floor(d / groupBy) * groupBy; };
    }
    function roundBy(round) {
      return function(d) { return Math.round(d / round) * round; };
    }
    if (bar.round && typeof bar.round === 'number') {
      bar.round = roundBy(bar.round);
    }

    dimensionFunc = spec.dimension || function(d) { return d[bar.api.id]; };
    if (spec.ordinal) {
      separation = 1;
      bar.round = Math.round;
      if (Array.isArray(spec.ordinal)) {
        spec.ordinal.forEach(function(o, i) { ordinalHash[o] = i; });
      } else {
        ordinalHash = spec.ordinal;
      }
      if (typeof ordinalHash === 'object') {
        ordinalOrdered = function(d) {
          var order = ordinalHash[d];
          if (!order && order !== 0) {
            return -1;
          }
          return order;
        };
      } else if (typeof spec.ordinal === 'function') {
        ordinalOrdered = spec.ordinal;
      } else {
        ordinalOrdered = function() { return -1; };
      }
      internalDimensionFunc = dimensionFunc;
      dimensionFunc = function(d) {
        return indexFromOrdinal[internalDimensionFunc(d)];
      };
      format = spec.format || function(d) { return d; };
    }

    if (spec.group) {
      groupFunc = spec.group;
    } else if (spec.groupBy) {
      separation = separation || spec.groupBy;
      groupFunc = groupFuncBy(separation);
    } else if (spec.groupIdentity || spec.ordinal) {
      groupFunc = function(d) { return d; };
    }

    if (spec.ordinal) {
      bar.ordinal = function() { return ordinal; };
      bar.api.ordinal = true;
    }

    bar.api.dimensionFunc = function() { return dimensionFunc; };
    bar.api.groupFunc = function() { return groupFunc; };
    bar.api.groups = function() { return groups; };

    bar.rawGroups = function() { return rawGroups; };
    bar.minX = function() { return minX; };
    bar.maxX = function() { return maxX; };
    bar.maxY = function() { return maxY; };
    bar.filterActive = function() { return filterActive; };
    bar.filterRange = function() { return filterRange; };

    bar.percent = function() {
      return crossAll.value() / groupAll.value();
    };

    bar.api.numGroups = function() {
      return groups.length;
    };

    bar.api.groupIndex = function(val) {
      return Math.floor((val - minX) / separation);
    };

    function setData(data) {
      var ordinalCount = 1e9,
          orderFromOrdinal = {},
          ord,
          ordArray = [];

      if (bar.ordinal) {
        data.forEach(function(d) {
          d = internalDimensionFunc(d);
          var order = orderFromOrdinal[d];
          if (typeof order !== 'undefined') {
            return;
          }
          order = ordinalOrdered(d);
          if (order >= 0) {
            orderFromOrdinal[d] = order;
            return;
          }
          orderFromOrdinal[d] = ordinalCount;
          ordinalCount++;
        });
        for (ord in orderFromOrdinal) {
          if (orderFromOrdinal.hasOwnProperty(ord)) {
            ordArray.push({value: ord, order: orderFromOrdinal[ord]});
          }
        }
        ordArray.sort(function(a, b) { return a.order - b.order; });
        ordArray.forEach(function(d, i) {
          indexFromOrdinal[d.value] = i;
          ordinal[i] = format(d.value);
        });
      }
    };

    setData(data);

    bar.api.filter = function(range) {
      if (!arguments.length) {
        return filterActive ? filterRange : null;
      }
      if (range) {
        filterActive = true;
        if (range === true) {
          range = filterRange;
        } else {
          filterRange = range;
        }
        if (dimension) {
          if (+range[0] === +range[1]) {
            dimension.filterExact(range[0]);
          } else {
            dimension.filterRange(range);
          }
        }
      } else {
        filterActive = false;
        if (dimension) {
          dimension.filterAll();
        }
      }
      bar.chartFilter();
      return bar;
    };

    bar.api.addCross = function(cross, all) {
      addedCross += 1;
      if (addedCross > 1) {
        return;
      }
      crossAll = all;
      dimension = cross.dimension(dimensionFunc);
      if (!groupFunc) {
        // Using d3.scale.linear to get a human-friendly way to
        // group the values into "numGroups"
        var top = dimension.top(Infinity),
            max = +dimensionFunc(top[0]),
            min = +dimensionFunc(top[top.length - 1]),
            domain = Math.abs(max - min),
            scale = d3.scale.linear().domain([0, domain]),
            ticks = scale.ticks(spec.numGroups || binfo.numGroups);

        separation = ticks[1] - ticks[0];
        groupFunc = groupFuncBy(separation);
      }
      group = dimension.group(groupFunc);
      rawGroups = group.all();
      groupAll = dimension.groupAll();
      if (!spec.minX) {
        minX = +rawGroups[0].key;
      }
      if (!spec.maxX) {
        maxX = +rawGroups[rawGroups.length - 1].key + separation;
      }

      // Fill in groups with empty groups when there is none
      var emptyGroup = {value: 0},
          r,
          g = 0,
          index,
          numGroups;
      groups = [];
      for (r = 0; r < rawGroups.length; r++) {
        index = bar.api.groupIndex(rawGroups[r].key);
        for (; g < index; g++) {
          groups.push(emptyGroup);
        }
        groups.push(rawGroups[r]);
        g += 1;
      }
      numGroups = Math.round((maxX - minX) / separation);
      for (; g < numGroups; g++) {
        groups.push(emptyGroup);
      }

      bar.api.filter(filterActive);
    };

    bar.api.add = function() {
      added += 1;
      bar.chartFilter();
      if (added > 1) {
        return;
      }
      bar.addChart();
      if (!filterRange) {
        var ticks = bar.x.ticks(20),
            dummyLeft = ticks[Math.round(ticks.length * 0.3)],
            dummyRight = ticks[Math.round(ticks.length * 0.7)];
        if (bar.round) {
          dummyLeft = bar.round(dummyLeft);
          dummyRight = bar.round(dummyRight);
        }
        filterRange = [dummyLeft, dummyRight];
      }
    };

    bar.api.removeCross = function() {
      addedCross -= 1;
    };

    bar.api.remove = function() {
      added -= 1;
      if (!added) {
        bar.api.filter(null);
      }
    };

    bar.api.update = function() {
      if (updated) return;
      updated = true;
      if (!spec.maxY) {
        maxY = group.top(1)[0].value;
      }
      bar.updateChart();
    };

    bar.api.resetUpdate = function() {
      if (!updated) return;
      updated = false;
      bar.resetUpdateChart();
    };

    bar.api.addToParams = function(params) {
      params.filter[bar.api.id] = bar.api.filter();
    };

  };


  logic.compareLogic = function(compare, spec) {

    var ids = spec.id.split('-'),
        xc = spec.charts[ids[0]],
        yc = spec.charts[ids[1]],
        given = null,
        crossAll,
        maxAll,
        xcDimensionFunc,
        ycDimensionFunc,
        xcGroupFunc,
        ycGroupFunc,
        xcNumGroups,
        ycNumGroups,
        xcGroups,
        ycGroups,
        levelsMatrix,
        levels = binfo.compareLevels,
        ycScale = Math.pow(2, 20),  // About a million
        dimensionFunc,
        filterRange,
        filterStats,
        filteredLevels,
        group,
        rawGroups,
        values;

    compare.api.id = spec.id;

    compare.xc = xc;
    compare.yc = yc;
    compare.levelsMatrix = function() { return levelsMatrix; };
    compare.xcNumGroups = function() { return xcNumGroups; };
    compare.ycNumGroups = function() { return ycNumGroups; };
    compare.filterStats = function() { return filterStats; };
    compare.round = Math.round;

    compare.api.given = function(_) {
      if (!arguments.length) return given;
      given = _;
    };

    compare.api.filter = function(_) {
      if (!arguments.length) return filterRange;
      if (_ && _.length === 4) {  // filter comes from hash
        filterRange = [[+_[0], +_[1]], [+_[2], +_[3]]];
      } else {
        filterRange = _;
      }
      filterStats = compare.stats(filterRange);
      hash.refreshParams();
      compare.chartFilter(filterRange);
    };

    compare.api.filterLevels = function(_) {
      if (!arguments.length) return filteredLevels;
      filteredLevels = _;
      hash.refreshParams();
      compare.chartLevels(_);
    };

    dimensionFunc = function(d) {
      var x = xc.groupIndex(xcGroupFunc(xcDimensionFunc(d))),
          y = yc.groupIndex(ycGroupFunc(ycDimensionFunc(d)));
      return x + y * ycScale;
    };

    compare.api.addToParams = function(params) {
      params.filterLevels[compare.api.id] = filteredLevels;
      params.given[compare.api.id] = given;
      var r = filterRange;
      // Convert from extent format to hash format.
      params.filter[compare.api.id] = r ? [r[0][0], r[0][1], r[1][0], r[1][1]] : null;
      params.filter[xc.id] = xc.filter();
      params.filter[yc.id] = yc.filter();
    };

    compare.api.addCross = function(cross, all) {
      crossAll = all;
      xc.addCross(cross, crossAll);
      yc.addCross(cross, crossAll);
      xcDimensionFunc = xc.dimensionFunc();
      ycDimensionFunc = yc.dimensionFunc();
      xcGroupFunc = xc.groupFunc();
      ycGroupFunc = yc.groupFunc();
      xcGroups = xc.groups();
      ycGroups = yc.groups();
      xcNumGroups = xc.numGroups();
      ycNumGroups = yc.numGroups();
      var dimension = cross.dimension(dimensionFunc);
      group = dimension.group();
      rawGroups = group.all();
      var i;
      values = [];
      levelsMatrix = [];
      for (i = 0; i < xcNumGroups; i++) {
        values[i] = [];
        levelsMatrix[i] = [];
      }
    };

    compare.api.add = function() {
      xc.add();
      yc.add();
      compare.addChart();
    };

    compare.api.remove = function() {
      xc.remove();
      yc.remove();
      compare.api.given(null);
      compare.api.filterLevels(null);
      compare.api.filter(null);
    };

    function passToXcYc(method) {
      compare.api[method] = function() {
        xc[method]();
        yc[method]();
      };
    }
    ['removeCross', 'resetUpdate'].forEach(function(pass) {
      passToXcYc(pass);
    });

    compare.api.update = function() {
      xc.update();
      yc.update();
      var xi,
          yi,
          i,
          n = rawGroups.length,
          d,
          normalizeLevels = levels - 1e-9,
          normalizeLog = normalizeLevels / 3,   // Three is the magic number
          val,
          log,
          level,
          normalize;
      for (xi = 0; xi < xcNumGroups; xi++) {
        for (yi = 0; yi < ycNumGroups; yi++) {
          values[xi][yi] = 0;
          levelsMatrix[xi][yi] = 0;
        }
      }
      i = -1;
      while (++i < n) {
        d = rawGroups[i];
        xi = d.key % ycScale;
        yi = Math.round(d.key / ycScale);
        values[xi][yi] = d.value;
      }
      if (!given) {
        normalize = normalizeLevels / (group.top(1)[0].value + 1e-300);
        for (xi = 0; xi < xcNumGroups; xi++) {
          for (yi = 0; yi < ycNumGroups; yi++) {
            levelsMatrix[xi][yi] = Math.floor(values[xi][yi] * normalize);
          }
        }
      } else if (given === 'yc') {
        for (yi = 0; yi < ycNumGroups; yi++) {
          normalize = xcNumGroups / (ycGroups[yi].value + 1e-300);
          for (xi = 0; xi < xcNumGroups; xi++) {
            val = values[xi][yi] * normalize;
            log = Math.log(1 + val) * normalizeLog;
            level = Math.min(levels - 1, Math.floor(log));
            levelsMatrix[xi][yi] = level;
          }
        }
      } else {
        for (xi = 0; xi < xcNumGroups; xi++) {
          normalize = ycNumGroups / (xcGroups[xi].value + 1e-300);
          for (yi = 0; yi < ycNumGroups; yi++) {
            val = values[xi][yi] * normalize;
            log = Math.log(1 + val) * normalizeLog;
            level = Math.min(levels - 1, Math.floor(log));
            levelsMatrix[xi][yi] = level;
          }
        }
      }

      filterStats = compare.stats(filterRange);
      compare.updateChart();
    };

    compare.stats = function(extent) {
      if (!extent) {
        return null;
      }
      var minXi = extent[0][0],
          minYi = extent[0][1],
          maxXi = extent[1][0],
          maxYi = extent[1][1],
          xi,
          yi,
          numXs,
          numYs,
          sum,
          rowTotal,
          rowHovered,
          levelsSum,
          hoveredArea,
          percent,
          level;
      sum = 0;
      levelsSum = 0;
      numXs = maxXi - minXi;
      numYs = maxYi - minYi;
      hoveredArea = numXs * numYs;
      for (xi = minXi; xi < maxXi; xi++) {
        for (yi = minYi; yi < maxYi; yi++) {
          sum += values[xi][yi];
          levelsSum += levelsMatrix[xi][yi];
        }
      }
      level = Math.round(levelsSum / hoveredArea);
      if (!given) {
        percent = sum / crossAll.value();
      } else if (given === 'yc') {
        sum = 0;
        for (yi = minYi; yi < maxYi; yi++) {
          rowTotal = ycGroups[yi].value;
          if (rowTotal) {
            rowHovered = 0;
            for (xi = minXi; xi < maxXi; xi++) {
              rowHovered += values[xi][yi] / rowTotal;
            }
          } else {
            rowHovered = numXs / xcNumGroups;
          }
          sum += rowHovered;
        }
        percent = sum / numYs;
      } else {
        sum = 0;
        for (xi = minXi; xi < maxXi; xi++) {
          rowTotal = xcGroups[xi].value;
          rowHovered = 0;
          if (rowTotal) {
            for (yi = minYi; yi < maxYi; yi++) {
              rowHovered += values[xi][yi] / rowTotal;
            }
          } else {
            rowHovered = numYs / ycNumGroups;
          }
          sum += rowHovered;
        }
        percent = sum / numXs;
      }
      return {level: level, percent: percent};
    };

  };
});


binfo._register('setup', ['core'], function(setup, core) {

  "use strict";

  var definitions = {},
      data = {},
      untypedData = {};

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

});


binfo._register('stylesheet', [], function(stylesheet) {

  stylesheet.setup = function(holder) {
    var css = '',
        i,
        lvl,
        levels = binfo.compareLevels,
        level = d3.scale.linear(),
        pts = [],
        domain,
        blue = 222,
        blueIndigo = 200,
        indigo = 180,
        indigoGreen = 158,
        green = 120,
        greenYellow = 80,
        yellow = 60,
        yellowOrange = 45,
        orange = 30,
        orangeRed = 15,
        red = 0,
        hue = d3.scale.linear(),
        saturation = d3.scale.linear(),
        fadeSaturation = d3.scale.linear(),
        brightness = d3.scale.linear(),
        fadeScale = d3.scale.linear(),
        fullScale = d3.scale.identity();
    level
        .domain([0, levels - 1])
        .range([0, 1]);

    pts = [
      {d: 0,      h: blue,        b: 35},
      {d: 0.17,   h: blueIndigo,  b: 40},
      {d: 0.22,   h: indigo,      b: 35},
      {d: 0.3,    h: indigoGreen, b: 38},
      {d: 0.41,   h: green,       b: 42},
      {d: 0.54,   h: greenYellow, b: 60},
      {d: 0.65,   h: yellow,      b: 50},
      {d: 0.725,  h: yellowOrange,b: 50},
      {d: 0.83,   h: orange,      b: 50},
      {d: 0.95,   h: orangeRed,   b: 50},
      {d: 1,      h: red,         b: 60}
    ];
    domain = pts.map(function(d) { return d.d; });
    hue.range(pts.map(function(d) { return d.h; }));
    brightness.range(pts.map(function(d) { return d.b;}));
    saturation
        .domain([0, 1])
        .range([100, 100]);
    fadeSaturation
        .domain([0, 1])
        .range([40, 40]);
    hue.domain(domain);
    brightness.domain(domain);
    fadeScale
        .domain([35, 60])
        .range([78, 92]);

    function addCss(prefix, sat, brightScale) {
      for (i = 0; i < levels; i++) {
        lvl = level(i);
        css += '.' + prefix + '-' + i + '{fill:hsl(';
        css += hue(lvl) + ',';
        css += sat(lvl) + '%,';
        css += brightScale(brightness(lvl)) + '%';
        css += ');}';
      }
    };

    addCss('level', saturation, fullScale);
    addCss('level-fade', fadeSaturation, fadeScale);

    holder.append('style').html(css);
  };


});


binfo._register('hashRetrieval', ['core'], function(_, core) {

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
    var hashParams = getHashParams();
    var dataName = hashParams.data,
        charts = hashParams.charts && hashParams.charts.split(','),
        params = {};

    params.given = getParams(hashParams.given);
    params.filter = getParams(hashParams.filter);
    params.filterLevels = getParams(hashParams.filterLevels);
    if (!dataName || !charts || !charts.length) {
      return;
    }
    core.renderFresh(dataName, charts, params);
  }

  function getParams(hashParam) {
    var paramArray = hashParam && hashParam.split(','),
        param = {};
    if (paramArray) {
      paramArray.forEach(function(p) {
        var map = p.split('*'),
            data = map.slice(1);
        if (data.length === 1) {
          data = data[0];
        }
        param[map[0]] = data;
      });
    }
    return param;
  }

  window.onhashchange = renderFromHash;

  renderFromHash();
});



binfo._register('hash', ['arrange'], function(hash, arrange) {

  var chartIds,
      charts,
      dataName,
      hashParams = [0,0,0],
      isEnable = true,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false;

  hash.disable = function() {
    isEnable = false;
  };

  hash.refresh = function(name, ids, c) {
    dataName = name;
    chartIds = ids;
    charts = c;
    isEnable = true;
    hash.refreshParams();
  };

  hash.refreshParams = function() {
    if (!isEnable) {
      return;
    }
    var params = {filter: {}, given: {}, filterLevels: {}};
    chartIds.forEach(function(id) { charts[id].addToParams(params); });
    hashParams = [
      'data=' + dataName,
      null,   // Reserved for chart ids
      paramString(params, 'given'),
      paramString(params, 'filterLevels'),
      paramString(params, 'filter')
    ];
    hashNeedsUpdated = true;
    if (!hashUpdatedRecently) {
      updateWindowHash();
    }
  };

  function paramString(params, string) {
    var param = params[string],
        data,
        id,
        paramArray = [];
    function filterEncode(d) {
      if (typeof d === 'object') {
        d = d.valueOf();
      }
      return encodeURIComponent(d);
    }
    for (id in param) {
      if (param.hasOwnProperty(id) && param[id]) {
        data = param[id];
        if (Array.isArray(data)) {
          data = data.map(filterEncode).join('*');
        }
        paramArray.push(id + '*' + data);
      }
    }
    return string + '=' + paramArray.join(',');
  }

  function updateWindowHash() {
    hashUpdatedRecently = false;
    var ordered = arrange.orderedChartIds(chartIds, charts);
    if (ordered) {
      hashNeedsUpdated = true;
      chartIds = ordered;
    } else {
      ordered = chartIds;
    }
    if (hashNeedsUpdated) {
      hashParams[1] = 'charts=' + ordered.join(',');
      var currentHash = '#' + hashParams.join('&');
      window.history.replaceState({}, '', currentHash);
      hashUpdatedRecently = true;
      hashNeedsUpdated = false;
    }
  }
  setInterval(updateWindowHash, 600);
});


binfo._register('rendering', ['core'], function(rendering, core) {

  "use strict";

  var chartSelection,
      formatNumber = d3.format(',d'),
      formatPercent = d3.format('.3p');

  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      d3.select(this).each(chartData.chart[name]);
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('resetUpdate');

  rendering.refresh = function(active, total) {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(active));
    d3.select('.total').text(formatNumber(total));
    d3.select('.percent-active').text(' (' + formatPercent(active / total) + ')');
  }

  rendering.render = function(chartIds, charts) {
    var chartData;

    chartData = chartIds.map(function(id, i) {
      return {chart: charts[id]};
    });

    chartSelection = d3.select('.holder').selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();
  };

});


binfo._register('ui', ['core'], function(ui, core) {

  "use strict";

  var rendering = ui.dependency('rendering'),
      setup = ui.dependency('setup'),
      holder,
      panel,
      disableModeTimer,
      dataName,
      numDataSets = 0,
      needsUpdate,
      chartMode,
      firstCompare;

  ui.setup = function(h) {
    holder = h;
    holder.attr('class', 'holder');

    var config,
        totals,
        interactions,
        statistics,
        updatePanel,
        viewToggles,
        optionsPanel;

    panel = holder.append('div')
        .attr('class', 'control-panel');

    panel.append('div')
        .attr('class', 'tool title')
        .text('Binfo');

    config = panel.append('div')
        .attr('class', 'config');

    totals = config.append('div')
        .attr('class', 'totals pane');
    totals.append('span')
        .attr('class', 'active-data')
        .text('-');
    totals.append('span')
        .attr('class', 'percent-active')
        .text(' (XX.X%)');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total')
        .text('-');
    totals.append('span')
        .attr('class', 'data-name');

    interactions = config.append('div')
        .attr('class', 'interactions pane')
        .on('mouseover', function() {
          if (disableModeTimer) {
            clearTimeout(disableModeTimer);
          }
        })
        .on('mouseout', function() {
          if (core.isMouseOut()) {
            disableModeTimer = setTimeout(setChartMode, 550);
          }
        });

    interactions.append('span').text('Add');

    interactions.append('div')
        .attr('class', 'bar button')
        .text('Bar')
        .on('click', function() { setChartMode('bar'); });

    interactions.append('span').text('or');

    interactions.append('div')
        .attr('class', 'compare button')
        .text('Comparison')
        .on('click', function() { setChartMode('compare'); });

    interactions.append('span').text('charts.');

    statistics = interactions.append('div')
        .attr('class', 'statistics')
        .style('display', 'none');
    statistics.append('ul');

    updatePanel = statistics.append('div')
        .attr('class', 'update panel')
        .style('display', 'none');
    updatePanel.append('div')
        .attr('class', 'update action button')
        .text('Update')
        .on('click', function() { core.update('force'); });
    updatePanel.append('div')
        .attr('class', 'cancel button')
        .text('Cancel')
        .style('display', 'none')
        .on('click', core.cancel);

    config.append('div')
        .attr('class', 'remove-all button')
        .text('Remove All')
        .on('click', core.clearCharts);



    viewToggles = panel.append('div')
        .attr('class', 'view-toggles pane');

    viewToggles.append('div')
        .text('Options')
        .attr('class', 'options button')
        .on('click', toggleOptionsPanel);

    optionsPanel = viewToggles.append('div')
        .attr('class', 'options-panel')
        .style('display', 'none');
    optionsPanel.append('div')
        .attr('class', 'title')
        .text('Options');
    optionsPanel.append('div')
        .attr('class', 'remove')
        .html('&#10006;')
        .on('click', toggleOptionsPanel);
    function changeUpdateMode() {
      var updateMode = this.id.slice(7);
      var always = updateMode === 'always';
      core.updateMode(updateMode);
      updatePanel.style('display', always ? 'none' : 'block');
      if (always) {
        core.update();
      }
    }
    function addUpdateStyle(style, label) {
      var div = optionsPanel.append('div');
      div.append('input')
          .attr('type', 'radio')
          .attr('name', 'update')
          .attr('id', style)
          .on('click', changeUpdateMode);
      div.append('label')
          .attr('for', style)
          .text(label);
    }
    addUpdateStyle('update-always', 'Always update automatically');
    addUpdateStyle('update-smart', 'Smart update (on mouse still)');
    addUpdateStyle('update-manual', 'Manual update');
    optionsPanel.select('#update-' + core.updateMode()).property('checked', true);
    optionsPanel.append('div')
        .attr('class', 'close-options button')
        .text('Close')
        .on('click', toggleOptionsPanel);

  };

  function toggleOptionsPanel() {
    var optionsPanel = panel.select('.options-panel'),
        disp = optionsPanel.style('display');
    optionsPanel.style('display', disp === 'block' ? 'none' : 'block');
    panel.select('.options.button').classed('down', disp === 'none');
  }

  function showStatistics(show) {
    show = show ? null : 'none';
    if (!needsUpdate) {
      panel.select('.statistics').style('display', show);
    }
    panel.select('.statistics ul').style('display', show);
  }

  function changeDataName(newDataName) {
    if (newDataName === dataName) {
      return;
    }
    var set = core.dataSet(newDataName),
        ids = set.definitionIds,
        defns = set.definitions,
        data,
        li;
    dataName = newDataName;
    if (numDataSets > 1) {
      panel.select('.data-name select').property('value', dataName);
    }
    data = ids.map(function(id) { return {id: id, label: defns[id].label}; });

    li = panel.select('.statistics ul').selectAll('li')
        .data(data, function(d) { return d.id; });
    li.enter().append('li')
        .on('click', clickChart)
        .text(function(d) { return d.label; });
    li.exit().remove();
  }

  function clickChart(d) {
    if (chartMode === 'compare') {
      if (firstCompare) {
        if (firstCompare !== d.id) {
          core.addChart(firstCompare + '-' + d.id);
        }
        firstCompareReset();
      } else {
        firstCompare = d.id;
        d3.select(this).classed('down', true);
      }
    } else {
      core.addChart(d.id);
    }
  }

  function firstCompareReset() {
    firstCompare = null;
    panel.selectAll('.statistics li.down').classed('down', false);
  }

  function setChartMode(mode) {
    if (chartMode === mode) {
      mode = null;
    }
    if (disableModeTimer) {
      clearTimeout(disableModeTimer);
    }
    chartMode = mode;
    panel.select('.compare.button').classed('down', mode === 'compare');
    panel.select('.bar.button').classed('down', mode === 'bar');
    if (mode) {
      showStatistics(true);
    } else {
      showStatistics(false);
      firstCompareReset();
    }
  }

  ui.addDataName = function(name) {
    numDataSets += 1;
    if (numDataSets === 1) {
      panel.select('.data-name')
          .text(name + '.');
    } else if (numDataSets === 2) {
      var nameHolder = panel.select('.data-name'),
          firstName = nameHolder.text();
      firstName = firstName.slice(0, firstName.length - 1);
      nameHolder.html('');
      nameHolder.append('select')
          .on('change', function() {
            changeDataName(this.value);
            core.changeDataName(this.value);
          });
      ui.addDataName(firstName);
      numDataSets -= 1;
      changeDataName(firstName);
    }
    if (numDataSets > 1) {
      panel.select('.data-name select').append('option')
          .attr('value', name)
          .text(name);
    }
  };

  ui.needsUpdate = function(needs) {
    needsUpdate = needs;
    if (needs) {
      panel.select('.statistics').style('display', 'block');
    }
    panel.select('.update.action.button').classed('active', needs);
    panel.select('.cancel.button').style('display', needs ? null : 'none');
  }

  ui.updating = function(updating) {
    holder.style('opacity', updating ? 0.3 : null);
    panel.classed('updating', updating);
  };

  ui.updated = function(name) {
    changeDataName(name);
    ui.needsUpdate(false);
    ui.updating(false);
  };

});

