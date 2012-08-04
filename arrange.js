
binfo._register('arrange', ['core'], function(arrange, core) {

  var outer,
      holder,
      maxWidth,
      maxLevel,
      arranging,
      ghost,
      positioner,
      holderNode,
      root,
      zIndex = 1,
      layout;

  arrange.setup = function(r, o, h, width) {
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
    maxWidth = width - 10;
    maxLevel = 0;
    layout = [];
    var dummyChart = {left: 0, width: 0, levels: 0},
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
    var chartHolderHeight = max * binfo.chartHeight + 820;
    holder.style('height', chartHolderHeight + 'px');
    outer.style('height', (chartHolderHeight + 30) + 'px');
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
    added.forEach(function(id) {
      var chart = charts[id],
          levels = chart.levels,
          width = chart.width,
          left,
          remaining,
          otherChart,
          fitting = 0,
          fitWidth,
          startLevel,
          direction = -1,
          i = maxLevel,
          j;
      while (i < layout.length) {
        otherChart = layout[i][layout[i].length - 1];
        left = otherChart.left + otherChart.width;
        remaining = maxWidth - left;
        if (remaining >= width || remaining === maxWidth) {
          if (fitting && remaining === fitWidth) {
            fitting += 1;
          } else {
            fitWidth = remaining;
            fitting = 1;
          }
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
  };

  arrange.orderedChartIds = function(chartIds, charts) {
    var order,
        newChartIds = [];
    order = chartIds.map(function(id) { return charts[id]; });
    order.sort(function(a, b) {
      if (a.top === b.top) {
        return a.left - b.left;
      }
      return a.top - b.top;
    });
    return order.map(function(chart) { return chart.id; });
  };

});


