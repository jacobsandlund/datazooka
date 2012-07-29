
binfo._register('arrange', ['core'], function(arrange, core) {

  var holder,
      maxWidth;

  arrange.setup = function(h, width) {
    holder = h;
    maxWidth = width - 10;
  };

  arrange.arrange = function(charts, chartIds) {
    var widths = [],
        lastLevel = 0,
        maxLevel = 0,
        i;
    for (i = 0; i < binfo.maxLevels; i++) {
      widths[i] = maxWidth;
    }
    chartIds.forEach(function(id) {
      var chart = charts[id],
          levels = chart.levels,
          width = chart.width,
          fitting = 0,
          fitWidth,
          direction = -1,
          i = lastLevel,
          j;
      while (i < widths.length) {
        if (widths[i] >= width || widths[i] === maxWidth) {
          if (fitting && widths[i] === fitWidth) {
            fitting += 1;
          } else {
            fitWidth = widths[i];
            fitting = 1;
          }
        }
        if (fitting === levels) {
          break;
        }
        if (i === 0 && direction === -1) {
          direction = 1;
          i = lastLevel - levels;
          if (i < 0) {
            i = -1;
          }
          fitting = 0;
        }
        i += direction;
      }
      lastLevel = (direction === 1) ? i - levels + 1 : i;
      for (j = lastLevel; j < lastLevel + levels; j++) {
        widths[j] -= width;
      }
      maxLevel = Math.max(i, maxLevel);
      chart.div
          .style('left', (maxWidth - fitWidth) + 'px')
          .style('top', (lastLevel * binfo.chartHeight) + 'px');
      chart.arranged = true;
    });

    var chartHolderHeight = (maxLevel + 1) * binfo.chartHeight + 200;
    holder.select('.charts').style('height', chartHolderHeight + 'px');
  };

});


