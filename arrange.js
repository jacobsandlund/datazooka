
binfo._register('arrange', ['core'], function(arrangeApi, coreApi) {

  var holder;

  coreApi.getHolder(function(h) { holder = h; });

  arrangeApi.arrange = function(charts, chartIds) {
    var selection = holder.select('.charts').selectAll('.chart'),
        dims = {},
        widths = [],
        maxWidth = binfo.width,
        lastLevel = 0,
        maxLevel = 0,
        i;
    selection.each(function(d) {
      var height = this.offsetHeight - binfo.chartBorder,
          levels = Math.ceil(height / binfo.chartHeight);
      height = levels * binfo.chartHeight - (binfo.chartBorder +
                                             2 * binfo.chartPadding);
      d3.select(this).style('height', height + 'px');
      dims[d.chart.id] = {
        levels: levels,
        width: this.offsetWidth - binfo.chartBorder
      };
    });

    for (i = 0; i < binfo.maxLevels; i++) {
      widths[i] = maxWidth;
    }
    chartIds.forEach(function(id) {
      var chart = charts[id],
          levels = dims[id].levels,
          width = dims[id].width,
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
      dims[id].left = maxWidth - fitWidth;
      dims[id].top = lastLevel * binfo.chartHeight;
    });

    selection.each(function(d) {
      var dim = dims[d.chart.id];
      d3.select(this)
          .style('left', dim.left + 'px')
          .style('top', dim.top + 'px');
    });

    var chartHolderHeight = (maxLevel + 1) * binfo.chartHeight + 200;
    holder.select('.charts').style('height', chartHolderHeight + 'px');
  };

});


