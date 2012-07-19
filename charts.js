
(function(binfo) {

  "use strict";

  function binfoCharts() {

    var charts = {};


    function baseChart(defn, spec, my) {

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

      my = my || {};
      my.dim = dim;

      function chart(div) {
        defn.update();
        my.update();
        div.each(updateEachChart);
      }

      function updateEachChart() {
        /*jshint validthis:true */
        var div = d3.select(this),
            root = div.select(my.root),
            data = div.datum();

        if (root.empty()) {
          root = my.setupChart(div, root, data);
        }

        my.updateChart(div, root, data);
      }

      my.baseSetupChart = function(div, setupDim, orientFlip) {
        var fullWidth = setupDim.left + setupDim.right,
            fullHeight = setupDim.top + setupDim.bottom;
        if (orientFlip) {
          fullWidth += setupDim.height;
          fullHeight += setupDim.width;
        } else {
          fullWidth += setupDim.width;
          fullHeight += setupDim.height;
        }
        div.select('.title')
            .text(defn.label);
        div.attr('width', fullWidth);

        var root = div.append('svg')
            .attr('width', fullWidth)
            .attr('height', fullHeight)
          .append('g')
            .attr('transform', 'translate(' + setupDim.left + ',' +
                                              setupDim.top + ')');
        return root;
      };


      defn.setChart(chart);

      return chart;
    }


    charts.barChart = function(defn, spec) {

      var my = {root: 'g'},
          chart = baseChart(defn, spec, my),
          dim = my.dim,
          defaultOrientFlip = false,
          compareHeightScale = spec.compareHeightScale || binfo.compareHeightScale,
          x = spec.x,
          y = spec.y || d3.scale.linear().range([dim.height, 0]),
          axis = d3.svg.axis().orient('bottom'),
          brush = d3.svg.brush(),
          percentFmt = d3.format('.3p'),
          path,
          brushDirty;

      if (defn.ordinal) {
        defaultOrientFlip = true;
      }

      if (defn.ordinal) {
        dim.bottom += 120;
      }

      my.setupChart = function(div, g, data) {

        var axisHolder,
            compare = data.compare,
            orientFlip = data.orientFlip,
            setupDim = dim,
            gPaths;

        if (defaultOrientFlip) orientFlip = !orientFlip;

        if (orientFlip) {
          setupDim = {
            top: dim.left,
            right: dim.top + 25,
            bottom: dim.right,
            left: dim.bottom + 50,
            width: dim.width,
            height: dim.height,
            binWidth: dim.binWidth
          };
        }

        setupDim.actualHeight = setupDim.height;
        if (compare) {
          setupDim.actualHeight *= compareHeightScale;
        }

        g = my.baseSetupChart(div, setupDim, orientFlip);
        if (orientFlip) {
          g   .attr('transform', 'matrix(0,1,-1,0,' + (setupDim.height +
                                 setupDim.left) + ',' + setupDim.top + ')')
              .classed('orient-flip', true);
        }

        gPaths = g.append('g');
        if (compare) {
          gPaths.attr('transform', 'scale(1,' + compareHeightScale + ')');
        }
        gPaths.append('clipPath')
            .attr('id', 'clip-' + defn.id)
          .append('rect')
            .attr('width', setupDim.width)
            .attr('height', setupDim.height);

        gPaths.selectAll('.bar')
            .data(['background', 'foreground'])
          .enter().append('path')
            .attr('class', function(d) { return d + ' bar'; });

        gPaths.selectAll('.foreground.bar')
            .attr('clip-path', 'url(#clip-' + defn.id + ')');


        axisHolder = g.append('g')
            .attr('class', 'axis');
        if (defn.ordinal) {
          axisHolder
              .attr('transform', 'matrix(0,-1,1,0,0,' + setupDim.actualHeight + ')')
              .classed('ordinal', true);
          axisHolder.append('line')
              .attr('x1', 0)
              .attr('y1', 0)
              .attr('x2', 0)
              .attr('y2', setupDim.width);
          axisHolder.selectAll('text')
              .data(defn.ordinal())
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

        if (!compare) {
          // The filter toggle and endpoints
          var filterBar = div.append('div').attr('class', 'filter-bar');
          filterBar.append('div')
              .text('Filter')
              .attr('class', 'filter button')
              .classed('down', !brush.empty())
              .on('click', function() {
                var el = d3.select(this);
                if (!defn.filterActive()) {
                  binfo.filter(defn.id, defn.filterRange());
                } else {
                  binfo.filter(defn.id, null);
                }
              });
          filterBar.selectAll('.range').data(['left', 'right'])
            .enter().append('input')
              .attr('type', 'text')
              .attr('class', function(d) { return 'range ' + d; })
              .property('value', function(d, i) { return defn.filterRange()[i]; })
              .on('change', function(d, i) {
                var range = defn.filterRange();
                range[i] = this.value;
                var left = x(range[0]),
                    right = x(range[1]);
                if (left <= right && right >= 0 && left <= setupDim.width) {
                  binfo.filter(defn.id, range);
                }
              });
        }

        return g;
      };

      my.update = function() {
        var groups = defn.groups(),
            pathParts = [],
            i = -1,
            n = groups.length,
            height = dim.height,
            bWidth = dim.binWidth - 1,
            d;
        y.domain([0, defn.maxY()]);
        while (++i < n) {
          d = groups[i];
          pathParts.push('M', x(d.key), ',', height, 'V', y(d.value),
                         'h', bWidth, 'V', height);
        }
        path = pathParts.join('');
      };

      my.updateChart = function(div, g, data) {

        var percentText,
            percent,
            compare = data.compare;

        // Only redraw the brush if set externally.
        if (brushDirty) {
          brushDirty = false;
          g.selectAll('.brush').call(brush);
          div.select('.filter.button').classed('down', defn.filterActive());
          div.selectAll('.range')
              .property('value', function(d, i) { return defn.filterRange()[i]; });
          if (defn.filterActive()) {
            var extent = brush.extent();
            g.selectAll('#clip-' + defn.id + ' rect')
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
            g.selectAll('#clip-' + defn.id + ' rect')
                .attr('x', 0)
                .attr('width', dim.width);
            g.selectAll('.percent').data([]).exit().remove();
          }
        }
        if (!compare) {
          percent = defn.crossAll().value() / defn.groupAll().value();
          percentText = g.selectAll('.percent').text(percentFmt(percent));
        }

        g.selectAll('.bar')
            .attr('d', path);
      };

      function resizePath(d, height) {
        var e = +(d === 'e'),
            x = e ? 1 : -1,
            h = dim.height * compareHeightScale,
            y = height / 2 - h / 2;
        return 'M' + (0.5 * x) + ',' + y +
               'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6) +
               'V' + (y + h - 6) +
               'A6,6 0 0 ' + e + ' ' + (0.5 * x) + ',' + (y + h) +
               'Z' +
               'M' + (2.5 * x) + ',' + (y + 8) +
               'V' + (y + h - 8) +
               'M' + (4.5 * x) + ',' + (y + 8) +
               'V' + (y + h - 8);
      }

      brush.on('brushstart.chart', function() {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select('.filter.button').classed('down', true);
      });

      brush.on('brush.chart', function() {
        var g = d3.select(this.parentNode),
            extent = brush.extent();
        if (defn.round) {
          g.select('.brush')
              .call(brush.extent(extent = extent.map(defn.round)));
        }
        binfo.filter(defn.id, extent);
      });

      brush.on('brushend.chart', function() {
        if (brush.empty()) {
          binfo.filter(defn.id, null);
        }
      });

      chart.setCross = function() {
        var minX = defn.minX(),
            maxX = defn.maxX(),
            ticks;

        if (!spec.x) {
          if (defn.type === 'date') {
            x = d3.time.scale();
          } else {
            x = d3.scale.linear();
          }
          x   .domain([minX, maxX])
              .rangeRound([0, defn.numGroups() * dim.binWidth]);
        }
        if (!defn.ordinal) {
          axis.scale(x);
        }
        brush.x(x);
        dim.width = x.range()[1];
        if (defn.ticks || defn.tickSpacing) {
          ticks = defn.ticks || Math.round(dim.width / defn.tickSpacing);
          axis.ticks(ticks);
        }
      };

      chart.filter = function(_) {
        if (_) {
          brush.extent(_);
        } else {
          brush.clear();
        }
        brushDirty = true;
        return chart;
      };

      return d3.rebind(chart, brush, 'on');
    };


    charts.compareChart = function(defn, spec) {

      var my = {root: 'g'},
          chart = baseChart(defn, spec, my),
          xb = defn.xb,
          yb = defn.yb,
          paths = [],
          levels = 8,
          scaleLevel = spec.scaleLevel || levels,
          dim = my.dim;

      my.setupChart = function(div, g) {
        var levelNums = [],
            i;
        for (i = 0; i < levels; i++) {
          levelNums.push(i);
        }
        g = my.baseSetupChart(div, dim);
        g.selectAll('.compare.bar')
            .data(levelNums)
          .enter().append('path')
            .attr('class', function(d) { return 'level-' + d + ' compare bar'; });
        return g;
      };

      my.update = function() {
        var values = defn.values(),
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

      my.updateChart = function(div, g) {
        g.selectAll('.compare.bar')
            .attr('d', function(d) { return paths[d]; });
      };

      chart.setCross = function() {
        dim.height = yb.numGroups() * dim.binWidth;
        dim.width = xb.numGroups() * dim.binWidth;
      };

      return chart;
    };


    return charts;

  }


  binfo._register('charts', binfoCharts, []);

}(window.binfo));

