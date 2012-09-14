
define('binfo/arrange', function(require, arrange) {

  var config = require('./config'),
      outer,
      holder,
      maxLevel,
      maxBottomLevel,
      reordered,
      arranging,
      ghost,
      positioner,
      dummyChart,
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
        .attr('class', 'positioner arranging')
        .style('display', 'none');
    positioner.div = positioner;
    maxLevel = 0;
    maxBottomLevel = 0;
    layout = [];
    dummyChart = {left: config.holderMargin, width: 0,
                  id: 'dummy', levels: 0, startLevel: 0};
    var i;
    for (i = 0; i < config.maxLevels; i++) {
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
    ghost.height = chart.height - config.chartBorder / 2;
    ghost.left = chart.left;
    ghost.top = chart.top;
    positioner.height = chart.height + config.chartBorder;
    positioner.width = chart.width + config.chartBorder;
    ghost.levels = chart.levels;
    ghost
        .style('display', 'block')
        .style('width', ghost.width + 'px')
        .style('height', ghost.height + 'px');
    reposition(ghost);
    positioner
        .style('display', 'block')
        .style('width', positioner.width + 'px')
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
    if (!chart.snapped) {
      doSnap(chart);
    }
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
        snapDiff = config.arrangeSnap;
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
    var level = Math.round(ghost.top / config.chartHeight),
        scale,
        bestEdge,
        bestDiff = 1e10,
        insert = false,
        topDiff;
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
    topDiff = Math.abs(ghost.top - level * config.chartHeight);
    scale = 0.5 * config.chartHeight;
    scale *= 1 / (config.arrangeInsertFocalDiff * config.arrangeInsertFocalDiff);
    // y < scale * x ^ 2
    if (topDiff < config.arrangeInsertMaxDiff && topDiff < scale * bestDiff * bestDiff) {
      insert = true;
      forChartAt(level, level + 1, function(chart) {
        if (chart.startLevel < level) {
          insert = false;
        }
      });
    }
    if (insert) {
      bestEdge = dummyChart.left;
      bestDiff = Math.abs(bestEdge - ghost.left);
    }
    snapPosition(positioner, bestEdge, level);
    chart.div.classed('insert', insert);
    positioner.classed('insert', insert);
    return {level: level, left: bestEdge, insert: insert,
            diff: bestDiff, topDiff: topDiff};
  }

  function maybeSnap(chart) {
    var snap = whereToSnap(chart);
    if (Math.abs(snap.topDiff) >= config.arrangeSnap) {
      return;
    }
    if (snap.diff >= config.arrangeSnap) {
      return;
    }
    doSnap(chart, snap);
  }

  function doSnap(chart, snap) {
    snap = snap || whereToSnap(chart);
    var addAt = null,
        level = snap.level,
        left = snap.left;
    if (snap.insert) {
      moveCharts(level, chart.levels);
    }
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
    setSnapped(chart, true, snap.insert);
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
    var max = 0;
    layout.forEach(function(row, i) {
      if (row.length > 1) {
        max = i;
      }
    });
    maxBottomLevel = max;
    maxLevel = 0;
    layout[max].forEach(function(chart) {
      maxLevel = Math.max(maxLevel, chart.startLevel);
    });
  }

  function forRowAt(start, end, callback) {
    var i;
    for (i = start; i < end; i++) {
      callback(layout[i], i);
    }
  }

  function forChartAt(start, end, callback) {
    forRowAt(start, end, function(row, i) {
      var j;
      for (j = 1; j < row.length; j++) {
        callback(row[j], j, i);
      }
    });
  }

  function forRowAtChart(chart, callback) {
    forChartAt(chart.startLevel,
               chart.startLevel + chart.levels, function(ch, j, i) {
      if (ch === chart) {
        callback(layout[i], j, i);
      }
    });
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
    var check = checkAtChart(chart),
        removeRows = [];
    forRowAtChart(chart, function(row, i, layoutI) {
      row.splice(i, 1);
      if (row.length === 1) {
        removeRows.push(layoutI);
      }
    });
    setSnapped(chart, false);
    checkAllMove(check);
    removeRows.forEach(function(removeI, i) {
      moveCharts(removeI - i, -1);  // minus i cause removeRows are moving down
    });
  }

  function moveCharts(start, amount) {
    var added,
        removed,
        updated = {};
    if (amount > 0) {
      added = layout.splice(layout.length - amount - 1, amount);
      layout.splice.apply(layout, [start, 0].concat(added));
    } else {
      removed = layout.splice(start, -amount);
      layout = layout.concat(removed);
    }
    maxLevel += amount;
    maxBottomLevel += amount;
    forChartAt(start, maxBottomLevel + 1, function(chart) {
      if (updated[chart.id]) {
        return;
      }
      snapPosition(chart, chart.left, chart.startLevel + amount);
      updated[chart.id] = true;
    });
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
    chart.top = level * config.chartHeight;
    reposition(chart);
  }

  function setSnapped(chart, snap) {
    chart.snapped = snap;
    chart.div.classed('unsnapped', !snap);
    positioner.classed('unsnapped', !snap);
  }

  function reposition(chart) {
    chart.div
        .style('left', chart.left + 'px')
        .style('top', chart.top + 'px');
  }

  arrange.add = function(added, charts) {
    var maxWidth = window.innerWidth - config.holderMargin - config.chartBorder;
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
            if (fitWidthDiff <= config.fitWidthMaxDiff) {
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
      forRowAt(startLevel, startLevel + levels, function(row) { row.push(chart); });
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
    var core = require('./core'),
        chartIds = core.chartIds(),
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

