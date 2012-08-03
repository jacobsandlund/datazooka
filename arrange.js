
binfo._register('arrange', ['core'], function(arrange, core) {

  var holder,
      maxWidth,
      maxLevel,
      arranging,
      ghost,
      chartsNode,
      root,
      zIndex = 1,
      layout;

  arrange.setup = function(r, h, width) {
    holder = h;
    root = r;
    var charts = holder.select('.charts');
    chartsNode = charts.node();
    ghost = charts.append('div')
        .attr('class', 'ghost')
        .style('display', 'none');
    ghost.div = ghost;
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
    ghost.height = chart.height;
    ghost.levels = chart.levels;
    ghost
        .style('display', 'block')
        .style('width', ghost.width + 'px')
        .style('height', ghost.height + 'px');
    swapGhost(chart, ghost);
    arranging = {
      chart: chart,
      offsetX: coords[0] - chart.left,
      offsetY: coords[1] - chart.top
    };
  };

  function arrangeEnd() {
    var chart = arranging.chart;
    if (ghost.snapped) {
      swapGhost(ghost, chart);
      ghost.style('display', 'none');
    }
    root.node().onselectstart = function() { return true; };
    arranging = null;
  }

  function swapGhost(toRemove, toAdd) {
    setSnapped(toAdd, true);
    snapPosition(toAdd, toRemove.left, toRemove.startLevel);
    forRowAtChart(toRemove, function(row, i) {
      row.splice(i, 1, toAdd);
    });
  }

  function mouseCoords() {
    var coords = d3.mouse(chartsNode),
        x = coords[0] + chartsNode.scrollLeft,
        y = coords[1] + chartsNode.scrollTop;
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
    chart.left = x - offsetX;
    chart.top = y - offsetY;
    reposition(chart);
    diffX = ghost.left - chart.left;
    diffY = ghost.top - chart.top;
    if (ghost.snapped) {
      if (abs(diffX) > snapDiff || abs(diffY) > snapDiff) {
        console.log('unsnap ghost');
        remove(ghost);
      }
    }
    if (!ghost.snapped) {
      maybeSnap(chart);
    }
  };

  function maybeSnap(chart) {
    var level = Math.round(chart.top / binfo.chartHeight),
        bestEdge = null,
        bestDiff = 1e10;
    if (level < 0) {
      level = 0;
    }
    if (level >= layout.length) {
      level = layout.length - 1;
    }
    forEdgesAtLevels(level, ghost.levels, function(edge) {
      var diff = Math.abs(edge - chart.left);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEdge = edge;
      }
    });
    snapPosition(ghost, bestEdge, level);
    if (Math.abs(level * binfo.chartHeight - chart.top) >= bestDiff) {
      return;
    }
    if (bestDiff >= binfo.arrangeSnap) {
      return;
    }

    // Add ghost at edge.
    console.log('snap ghost');
    var addAt = null;
    forEdgesAtLevels(level, ghost.levels, function(edge, i) {
      if (edge > bestEdge && addAt === null) {
        addAt = i;
      }
    }, function(row) {
      if (addAt === null) {
        addAt = row.length;
      }
      row.splice(addAt, 0, ghost);
      addAt = null;
    });
    setSnapped(ghost, true);
    checkAllMoveAtChart(ghost);
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

    var i,
        j,
        row,
        found;
    for (i = maxLevel; i >= 0; i--) {
      row = layout[i];
      for (j = 1; j < row.length; j++) {
        if (row[j].startLevel === i) {
          maxLevel = i;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      maxLevel = 0;
    }
  };

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

    var levels = d3.max(layout[maxLevel], function(d) { return d.levels; }),
        chartHolderHeight = (maxLevel + levels) * binfo.chartHeight + 200;
    holder.select('.charts').style('height', chartHolderHeight + 'px');
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


