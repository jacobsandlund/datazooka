
define('charts', function(require, exports) {

  var d3 = require('d3'),
      logic = require('./logic'),
      arrange = require('./arrange'),
      config = require('./config'),
      core;

  exports.barChart = function(spec, data) {

    // TODO: Remove circular dependency
    core = require('./core');

    var bar = {api: {}};
    logic.barLogic(bar, spec, data);
    barChart(bar, spec);
    return bar.api;
  };

  exports.compareChart = function(spec) {
    var compare = {api: {}};
    logic.compareLogic(compare, spec);
    compareChart(compare, spec);
    return compare.api;
  };


  function findTextWidth(text, size) {
    if (typeof size === 'number') size += 'px';
    var span = d3.select('#holder').append('span')
        .style('font-size', size)
        .text(text);
    var width = span.property('offsetWidth');
    span.remove();
    return Math.ceil(width);
  }

  function findDim(spec) {
    var dim = spec.dimensions || {},
        defaultDim = config.chartDimensions,
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
    div .classed('chart-' + api.id, true)
      .append('div')
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
    var width = div.property('offsetWidth') - config.chartBorder,
        innerWidth = width - config.chartPadding * 2 - config.chartBorder,
        height,
        levels;
    api.width = width;
    div.style('width', innerWidth + 'px');
    div.select('.title')
        .style('width', (innerWidth - 15) + 'px')   // 15 for Remove 'x'
        .style('display', null);
    height = div.property('offsetHeight') - config.chartBorder - 5;
    levels = Math.ceil(height / config.chartHeight);
    api.levels = levels;
    api.height = levels * config.chartHeight;
    height = api.height - (config.chartBorder + 2 * config.chartPadding);
    api.snapped = false;
    div.style('height', height + 'px');
  }

  function activateBrush(brush, filter, clips) {
    brush.onbrush = function(a, b) {
      var g = d3.select(this.parentNode),
          extent = brush.extent(),
          move = d3.event.mode === 'move',
          floor = move ? clips.round : clips.floor,
          ceil = move ? clips.round : clips.ceil;
      if (clips.round) {
        if (extent && Array.isArray(extent[0])) {
          extent = [extent[0].map(floor), extent[1].map(ceil)];
        } else {
          extent = [floor(extent[0]), ceil(extent[1])];
        }
        g.select('.brush')
            .call(brushUpdate, brush.extent(extent));
      }
      if (!brush.empty()) {
        filter(extent);
      }
    };
    brush.on('brush', brush.onbrush);

    brush.onbrushend = function() {
      if (brush.empty()) {
        filter(null);
      }
    };
    brush.on('brushend', brush.onbrushend);
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
    var gBrush = parent.append('g')
        .attr('class', 'brush');
    gBrush.append('text')
        .attr('class', 'remove')
        .on('mousedown', function() {
          brush.clear();
          brush.onbrushend();
          return false;
        })
        .text('✖');
    gBrush.call(brushUpdate, brush);
    if (height) {
      gBrush.selectAll('rect').attr('height', height);
    }
    var resize = height ? resizePath : function() { return 'M0,0'; };
    gBrush.selectAll('.resize').append('path').attr('d', function(d) {
      return resize(d, height);
    });
    return gBrush;
  }

  function brushUpdate(gBrush, brush) {
    var extent = brush.extent(),
        topRight,
        removeText;
    if (Array.isArray(extent[0])) {
      topRight = [extent[1][0], extent[0][1]];
      topRight[1] = brush.y()(topRight[1]);
    } else {
      topRight = [extent[1], 0];
    }
    topRight[0] = brush.x()(topRight[0]);
    removeText = gBrush.select('.remove').remove();
    gBrush.call(brush);
    gBrush.node().appendChild(removeText.node());
    removeText
        .attr('x', topRight[0] - 6)
        .attr('y', topRight[1] + 11)
        .style('display', brush.empty() ? 'none' : null);
  }


  var percentFmt = d3.format('.3p');

  var clipId = 0;

  function barChart(bar, spec) {

    var dim = findDim(spec),
        baseDim = findBaseDim(dim),
        defaultOrientFlip = false,
        compareHeightScale = spec.compareHeightScale || config.compareHeightScale,
        x = spec.x,
        y = spec.y || d3.scale.linear().range([dim.height, 0]),
        tickSpacing = spec.tickSpacing || config.tickSpacing,
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

    dim.labelWidth = findTextWidth(bar.api.label, config.axisLabelSize);

    function filter(range) {
      bar.api.filter(range);
      core.refresh();
    }

    activateBrush(brush, filter, bar);

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
        g.selectAll('.brush').call(brushUpdate, brush);
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
          maxOrd = Math.max(maxOrd, findTextWidth(ord, config.axisTickSize));
        });
        dim.bottom = baseDim.bottom + maxOrd;
        dim.maxTickWidth = 0;
      } else {
        fmt = axis.tickFormat() || x.tickFormat();
        tix = axis.tickValues() || x.ticks(tix || config.numGroups);
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
        levels = config.compareLevels,
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
    activateBrush(brush, filter, compare);
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
          legendClips,
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

      legendClips = {round: compare.round, ceil: compare.round,
                     floor: compare.round};

      function filterLevels(range) {
        compare.api.filterLevels(range);
      }

      activateBrush(legendBrush, filterLevels, legendClips);

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
      gBrush.select('text.remove')
          .attr('transform', 'translate(12,-1)');

      compare.updateLegend = function(range) {
        if (range) {
          legendBrush.extent(range);
        } else {
          legendBrush.clear();
          range = [0, 100];
        }
        gBrush.call(brushUpdate, legendBrush);
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
          .rangeRound([0, compare.xcNumGroups() * dim.binWidth]);
      var yScale = d3.scale.linear()
          .domain([0, compare.ycNumGroups()])
          .rangeRound([0, compare.ycNumGroups() * dim.binWidth]);
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
        compare.api.div.selectAll('g.compare .brush').call(brushUpdate, brush);
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

