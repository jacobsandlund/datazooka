
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


  function baseSetupChart(div, api) {
    var title = div.select('.title').text(api.label);
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
    var height = div.property('offsetHeight') - binfo.chartBorder - 5,
        levels = Math.ceil(height / binfo.chartHeight);
    api.levels = levels;
    api.height = levels * binfo.chartHeight;
    height = api.height - (binfo.chartBorder + 2 * binfo.chartPadding);
    api.width = div.property('offsetWidth') - binfo.chartBorder;
    api.div = div;
    api.snapped = false;
    div.style('height', height + 'px');
  }



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

    function filter(range) {
      bar.api.filter(range);
      core.refresh();
    }

    brush.on('brush.chart', function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (bar.round) {
        g.select('.brush')
            .call(brush.extent(extent = extent.map(bar.round)));
      }
      if (!brush.empty()) {
        filter(extent);
      }
    });

    brush.on('brushend.chart', function() {
      if (brush.empty()) {
        filter(null);
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


    bar.api.label = spec.label;
    bar.api.defaultOrientFlip = defaultOrientFlip;
    bar.api.dim = dim;

    bar.resetUpdateChart = function() {
      brushDirty = false;
    };

  }



  function compareChart(compare, spec) {

    var dim = findDim(spec),
        xc = compare.xc,
        yc = compare.yc,
        bgPath,
        paths = [],
        levels = 54;

    dim.left = yc.dim.bottom + 60;
    dim.bottom = xc.dim.bottom + 50;
    compare.api.label = xc.label + ' vs. ' + yc.label;

    function given(what) {
      compare.api.given(what);
      core.refresh();
    }

    compare.updateChart = function() {
      var values = compare.values(),
          xn = values.length,
          yn = values[0].length,
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
          level = Math.floor(values[xi][yi] * levels - 1e-6);
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
        setupChart(g);
        setupChartPeripherals(div);
        baseArrange(div, compare.api);
      }

      renderUpdate(div, g);
    }

    function setupChart(g) {
      var levelNums = [],
          gCompare,
          rectWidth,
          rectHeight,
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
      gCompare = g.append('g')
          .attr('transform', 'translate(' + dim.xLeft + ',' + dim.yTop + ')');
      gCompare.selectAll('.compare.bar')
          .data(levelNums)
        .enter().append('path')
          .attr('class', function(d) { return 'level-' + d + ' compare bar'; });

      g.append('g')
          .attr('transform', 'translate(' + (-dim.left + 10) + ',' +
                              (dim.yWidth / 2) + ') rotate(90)')
        .append('text')
          .attr('class', 'axis-label')
          .text(yc.label);
      g.append('text')
          .attr('x', dim.xLeft + dim.xWidth / 2)
          .attr('y', dim.height + dim.bottom - 20)
          .attr('class', 'axis-label')
          .text(xc.label);

      rectWidth = 5;
      rectHeight = 3;
      g.selectAll('rect.level')
          .data(levelNums)
        .enter().append('rect')
          .attr('class', function(d) { return 'level level-' + d; })
          .attr('x', dim.width + 5)
          .attr('y', function(d, i) {
            return dim.xTop - 4 - i * rectHeight;
          })
          .attr('width', rectWidth)
          .attr('height', rectHeight);
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
              given(null);
            } else {
              given(d);
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

    compare.addChart = function() {
      dim.xHeight = xc.dim.compareHeight;
      dim.yHeight = yc.dim.compareHeight;
      dim.xWidth = xc.dim.width;
      dim.yWidth = yc.dim.width;
      dim.xTop = dim.yWidth + 4;
      dim.xLeft = dim.yHeight + 2;
      dim.yTop = 2;
      dim.width = dim.yHeight + dim.xWidth + 4;
      dim.height = dim.yWidth + dim.xHeight + 4;
      dim.actualHeight = dim.height;
      bgPath = 'M-1,-1V' + (dim.xTop - dim.yTop - 2) +
               'H' + (dim.width - dim.xLeft - 2) + 'V-1H-1';
    };

    compare.api.cleanUp = function() {
    };

  };
});

