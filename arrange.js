
binfo._register('arrange', ['core'], function(arrange, core) {

  var holder,
      maxWidth,
      maxLevel,
      arranging,
      chartsNode,
      root,
      zIndex = 1,
      layout;

  arrange.setup = function(r, h, width) {
    holder = h;
    root = r;
    chartsNode = holder.select('.charts').node();
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
        root.node().onselectstart = function() { return true; };
        arranging = null;
      }
    });
  };

  arrange.start = function(chart) {
    var coords = mouseCoords();
    root.node().onselectstart = function() { return false; };
    zIndex += 1;
    chart.div.style('z-index', zIndex);
    arranging = {
      chart: chart,
      offsetX: coords[0] - chart.left,
      offsetY: coords[1] - chart.top
    };
  };

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
        chartX = chart.left + offsetX,
        chartY = chart.top + offsetY,
        diffX = x - chartX,
        diffY = y - chartY,
        abs = Math.abs,
        snapDiff = binfo.arrangeSnap;
    if (chart.snapped) {
      if (abs(diffX) > snapDiff || abs(diffY) > snapDiff) {
        chart.div.classed('unsnapped', true);
        remove(chart);
      }
    }
    if (!chart.snapped) {
      chart.left += diffX;
      chart.top += diffY;
      reposition(chart);
    }
  };

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
    chart.snapped = false;
    checkAllMove(check);
  }

  function checkAllMove(check) {
    check.forEach(function(c) { checkMove(c); });
  }

  function checkMove(chart) {
    var left = 0;
    forRowAtChart(chart, function(row, i) {
      left = Math.max(left, row[i - 1].left + row[i - 1].width);
    });
    if (left !== chart.left) {
      chart.left = left;
      reposition(chart);
      checkAllMove(checkAtChart(chart));
    }
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
      chart.startLevel = startLevel;
      chart.left = maxWidth - fitWidth;
      chart.top = chart.startLevel * binfo.chartHeight;
      chart.snapped = true;
      reposition(chart);
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


