
binfo._register('arrange', ['core'], function(arrange, core) {

  var holder,
      maxWidth,
      maxLevel,
      layout;

  arrange.setup = function(h, width) {
    holder = h;
    maxWidth = width - 10;
    maxLevel = 0;
    layout = [];
    var dummyChart = {left: 0, width: 0, levels: 0},
        i;
    for (i = 0; i < binfo.maxLevels; i++) {
      layout[i] = [dummyChart];
    }
  };

  arrange.remove = function(removed, charts) {
    removed.forEach(function(id) {
      var chart = charts[id],
          row,
          i,
          j;
      for (i = chart.startLevel; i < chart.startLevel + chart.levels; i++) {
        row = layout[i];
        for (j = 1; j < row.length; j++) {
          if (row[j] === chart) {
            row.splice(j, 1);
          }
        }
      }
    });

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
  };

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
      chart.div
          .style('left', chart.left + 'px')
          .style('top', (startLevel * binfo.chartHeight) + 'px');
      chart.arranged = true;
    });

    var levels = d3.max(layout[maxLevel], function(d) { return d.levels; }),
        chartHolderHeight = (maxLevel + levels) * binfo.chartHeight + 200;
    holder.select('.charts').style('height', chartHolderHeight + 'px');
  };

  arrange.orderedChartIds = function(chartIds) {
    var added = {},
        newChartIds = [],
        row,
        chart,
        i,
        j;
    for (i = 0; i < layout.length; i++) {
      row = layout[i];
      for (j = 1; j < row.length; j++) {
        chart = row[j];
        if (!added[chart.id]) {
          newChartIds.push(chart.id);
          added[chart.id] = true;
        }
      }
      if (newChartIds.length === chartIds.length) {
        break;
      }
    }
    return newChartIds;
  };

});


