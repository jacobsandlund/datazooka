
binfo._register('charts', ['logic'], function(logicApi) {

  "use strict";

  var chartsApi = {};

  chartsApi.barChart = function(spec, data) {
    var bar = {api: {}};
    logicApi.barLogic(bar, spec, data);
    barChart(bar, spec);
    return bar.api;
  };

  chartsApi.compareChart = function(spec) {
    var compare = {api: {}};
    logicApi.compareLogic(compare, spec);
    compareChart(compare, spec);
    return compare.api;
  };


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


  function baseSetupChart(div, label, setupDim, orientFlip) {

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
    div.select('.title').text(label);
    div.attr('width', fullWidth);

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

  };



  var clipId = 0;

  function barChart(bar, spec) {

    var dim = findDim(spec),
        defaultOrientFlip = false,
        compareHeightScale = spec.compareHeightScale || binfo.compareHeightScale,
        x = spec.x,
        y = spec.y || d3.scale.linear().range([dim.height, 0]),
        tickSpacing = spec.tickSpacing || binfo.tickSpacing,
        ticks = spec.ticks,
        axis = d3.svg.axis(),
        brush = d3.svg.brush(),
        percentFmt = d3.format('.3p'),
        path,
        brushDirty;

    if (spec.tickSpacing === false) {
      tickSpacing = false;
    }

    dim.compareHeight = dim.height * compareHeightScale;
    if (bar.ordinal) {
      defaultOrientFlip = true;
    }

    if (bar.ordinal) {
      dim.bottom += 120;
    }

    brush.on('brushstart.chart', function() {
      var div = d3.select(this.parentNode.parentNode.parentNode);
      div.select('.filter.button').classed('down', true);
    });

    brush.on('brush.chart', function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (bar.round) {
        g.select('.brush')
            .call(brush.extent(extent = extent.map(bar.round)));
      }
      if (!brush.empty()) {
        chartsApi.filter(bar.api.id, extent);
      }
    });

    brush.on('brushend.chart', function() {
      if (brush.empty()) {
        chartsApi.filter(bar.api.id, null);
      }
    });

    bar.updateChart = function() {
      var groups = bar.groups(),
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
          setupDim = dim,
          data = root.datum(),
          orientFlip = data.orientFlip,
          compare = data.compare,
          checkSelection,
          i;

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
            right: dim.top + 25,
            bottom: dim.right,
            left: dim.bottom + 40,
          };
          for (i in dim) {
            if (dim.hasOwnProperty(i) && typeof setupDim[i] === 'undefined') {
              setupDim[i] = dim[i];
            }
          }
        }
        setupDim.actualHeight = compare ? setupDim.compareHeight : setupDim.height;

        if (!compare) {
          g = baseSetupChart(div, bar.api.label, setupDim, orientFlip);
        }
        setupChart(g, setupDim, data);
        if (!compare) {
          setupChartPeripherals(div, setupDim);
        }
      }

      renderUpdate(div, g, data);
    };


    function setupChart(g, setupDim, data) {

      var orientFlip = data.orientFlip,
          compare = data.compare,
          axisHolder,
          gPaths;


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

      // Initialize the brush component with pretty resize handles.
      var gBrush = g.append('g').attr('class', 'brush').call(brush);
      gBrush.selectAll('rect').attr('height', setupDim.actualHeight);
      gBrush.selectAll('.resize').append('path').attr('d', function(d) {
        return resizePath(d, setupDim.actualHeight);
      });
      if (orientFlip) {
        gBrush.selectAll('.resize')
            .style('cursor', 'ns-resize');
      }
    }

    function setupChartPeripherals(div, setupDim) {
      // The filter toggle and endpoints
      var filterBar = div.append('div').attr('class', 'peripherals filter-bar');
      filterBar.append('div')
          .text('Filter')
          .attr('class', 'filter button')
          .classed('down', bar.filterActive())
          .on('click', function() {
            var el = d3.select(this);
            if (!bar.filterActive()) {
              chartsApi.filter(bar.api.id, bar.filterRange());
            } else {
              chartsApi.filter(bar.api.id, null);
            }
          });
      filterBar.selectAll('.range').data(['left', 'right'])
        .enter().append('input')
          .attr('type', 'text')
          .attr('class', function(d) { return 'range ' + d; })
          .property('value', function(d, i) { return bar.filterRange()[i]; })
          .on('change', function(d, i) {
            var range = bar.filterRange();
            range[i] = this.value;
            var left = x(range[0]),
                right = x(range[1]);
            if (left <= right && right >= 0 && left <= setupDim.width) {
              chartsApi.filter(bar.api.id, range);
            }
          });
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
          div.select('.filter.button').classed('down', bar.filterActive());
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

    function resizePath(d, height) {
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

    bar.setCrossChart = function() {
      var minX = bar.minX(),
          maxX = bar.maxX(),
          tix;

      if (!spec.x) {
        if (bar.type === 'date') {
          x = d3.time.scale();
        } else {
          x = d3.scale.linear();
        }
        x   .domain([minX, maxX])
            .rangeRound([0, bar.api.numGroups() * dim.binWidth]);
      }
      if (!bar.ordinal) {
        axis.scale(x);
      }
      brush.x(x);
      dim.width = x.range()[1];
      if (ticks || tickSpacing) {
        tix = bar.ticks || Math.round(dim.width / tickSpacing);
        axis.ticks(tix);
      }
    };

    bar.chartFilter = function(_) {
      if (_) {
        brush.extent(_);
      } else {
        brush.clear();
      }
      brushDirty = true;
    };


    bar.api.label = spec.label;
    bar.api.defaultOrientFlip = defaultOrientFlip;
    bar.api.dim = dim;

    bar.api.cleanUp = function() {
      brushDirty = false;
    };

  }



  function compareChart(compare, spec) {

    var dim = findDim(spec),
        xc = compare.xc,
        yc = compare.yc,
        paths = [],
        levels = 8,
        scaleLevel = spec.scaleLevel || levels;

    dim.left = yc.dim.bottom + 60;
    dim.bottom = xc.dim.bottom + 30;
    compare.api.label = 'Comparing ' + xc.label + ' and ' + yc.label,

    compare.updateChart = function() {
      var values = compare.values(),
          xn = values.length,
          yn = values[0].length,
          pathParts = [],
          xi,
          yi,
          level,
          area,
          val,
          val2,
          bWidth = dim.binWidth,
          mid = bWidth / 2,
          x,
          y;
      for (xi = 0; xi < levels; xi++) {
        pathParts[xi] = [];
      }
      pathParts[-2] = pathParts[-1] = {push: function() {}};
      for (xi = 0; xi < xn; xi++) {
        x = xi * bWidth + mid;
        for (yi = 0; yi < yn; yi++) {
          y = yi * bWidth + mid;
          area = values[xi][yi] * scaleLevel;
          level = Math.min(Math.floor(area), levels - 1);
          val = Math.sqrt(area - level) * mid;
          val2 = val * 2;
          pathParts[level].push('M', x - val, ',', y - val,
                                'v', val2, 'h', val2, 'v', -val2);
          pathParts[level-1].push('M', x - mid, ',', y - mid,
                                  'v', bWidth, 'h', bWidth, 'v', -bWidth);
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
        g = baseSetupChart(div, compare.api.label, dim, false);
        setupChart(g);
        setupChartPeripherals(div);
      }

      renderUpdate(div, g);
    }

    function setupChart(g) {
      var levelNums = [],
          gCompare,
          i;
      for (i = 0; i < levels; i++) {
        levelNums.push(i);
      }
      g.classed('compare', true);
      g.append('g')
          .attr('class', 'yc inner-chart')
          .datum({compare: true, orientFlip: true})
          .attr('transform', 'matrix(0,1,-1,0,' + dim.yHeight +
                              ',' + dim.yTop + ')');
      g.append('g')
          .attr('class', 'xc inner-chart')
          .attr('transform', 'translate(' + dim.xLeft + ',' + dim.xTop + ')')
          .datum({compare: true, orientFlip: false});
      g.append('path')
          .attr('stroke', 'black')
          .attr('fill', 'white')
          .attr('shape-rendering', 'crispEdges')
          .attr('d', 'M' + (dim.yHeight + 1) + ',1V' + (dim.xTop - 2) +
                      'H' + (dim.width - 2) + 'V1' + 'H' + (dim.yHeight + 1));
      gCompare = g.append('g')
          .attr('transform', 'translate(' + dim.xLeft + ',' + dim.yTop + ')');
      gCompare.selectAll('.compare.bar')
          .data(levelNums)
        .enter().append('path')
          .attr('class', function(d) { return 'level-' + d + ' compare bar'; });

      g.append('text')
          .attr('x', -dim.left + 10)
          .attr('y', dim.yWidth / 2)
          .style('writing-mode', 'tb')
          .style('text-anchor', 'middle')
          .text(yc.label);
      g.append('text')
          .attr('x', dim.xLeft + dim.xWidth / 2)
          .attr('y', dim.height + dim.bottom - 5)
          .style('text-anchor', 'middle')
          .text(xc.label);
      return g;
    }

    function setupChartPeripherals(div) {
      var givenBar = div.append('div')
          .attr('class', 'peripherals given-bar')
          .style('margin-left', (dim.left + dim.xLeft) + 'px');
      givenBar.selectAll('.given.button')
          .data(['xc', 'yc'])
        .enter().append('div')
          .text(function(d) { return 'Given ' + compare[d].label; })
          .attr('class', function(d) { return d + ' given button'; })
          .classed('down', function(d) { return compare.api.given() === d; })
          .on('click', function(d) {
            var el = d3.select(this);
            if (compare.api.given() === d) {
              chartsApi.given(compare.api.id, null);
            } else {
              chartsApi.given(compare.api.id, d);
            }
          });
    }

    function renderUpdate(div, g) {
      g.selectAll('.yc.inner-chart').each(yc.render);
      g.selectAll('.xc.inner-chart').each(xc.render);
      g.selectAll('.compare.bar')
          .attr('d', function(d) { return paths[d]; });
      div.selectAll('.given.button')
          .classed('down', function(d) { return compare.api.given() === d; });
    }

    compare.setCrossChart = function() {
      dim.xHeight = xc.dim.compareHeight;
      dim.yHeight = yc.dim.compareHeight;
      dim.xWidth = xc.dim.width;
      dim.yWidth = yc.dim.width;
      dim.xTop = dim.yWidth + 6;
      dim.xLeft = dim.yHeight + 3;
      dim.yTop = 3;
      dim.width = dim.yHeight + dim.xWidth + 6;
      dim.height = dim.yWidth + dim.xHeight + 6;
      dim.actualHeight = dim.height;
    };

    compare.api.cleanUp = function() {
    };

  };

  return chartsApi;
});

