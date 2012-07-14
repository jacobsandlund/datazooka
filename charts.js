(function(binfo) {

  "use strict";

  var charts = {};
  binfo.charts = charts;

  charts.chartCreator = function(defn, spec) {

    var margin = spec.margin || {top: 20, right: 10, bottom: 20, left: 10},
        binWidth = spec.binWidth || binfo.binWidth,
        height = spec.chartHeight || binfo.chartHeight,
        x = spec.x,
        y = spec.y || d3.scale.linear().range([height, 0]),
        axis = d3.svg.axis().orient('bottom'),
        brush = d3.svg.brush(),
        percentFmt = d3.format('.3p'),
        width,
        chartWidth,
        brushDirty;

    function chart(div) {
      defn.update();

      y.domain([0, defn.maxY()]);

      div.each(function() {
        var div = d3.select(this),
            g = div.select('g');

        // Create the skeletal chart.
        if (g.empty()) {
          div.attr('width', chartWidth);
          div.select('.title')
              .text(defn.label);

          g = div.append('svg')
              .attr('width', chartWidth)
              .attr('height', height + margin.top + margin.bottom)
            .append('g')
              .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

          g.append('clipPath')
              .attr('id', 'clip-' + defn.id)
            .append('rect')
              .attr('width', width)
              .attr('height', height);

          g.selectAll('.bar')
              .data(['background', 'foreground'])
            .enter().append('path')
              .attr('class', function(d) { return d + ' bar'; });

          g.selectAll('.foreground.bar')
              .attr('clip-path', 'url(#clip-' + defn.id + ')');

          g.append('g')
              .attr('class', 'axis')
              .attr('transform', 'translate(0,' + height + ')')
              .call(axis);

          // Initialize the brush component with pretty resize handles.
          var gBrush = g.append('g').attr('class', 'brush').call(brush);
          gBrush.selectAll('rect').attr('height', height);
          gBrush.selectAll('.resize').append('path').attr('d', resizePath);

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
                if (left <= right && left >= 0 && right < width) {
                  binfo.filter(defn.id, range);
                }
              });
        }

        var percentText;

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
            percentText = g.selectAll('.percent').data([1]);
            percentText.enter().append('text')
                .attr('class', 'percent')
                .attr('y', -4);
            percentText
                .attr('x', (x(extent[1]) + x(extent[0])) / 2);
          } else {
            g.selectAll('#clip-' + defn.id + ' rect')
                .attr('x', 0)
                .attr('width', width);
            g.selectAll('.percent').data([]).exit().remove();
          }
        }
        var percent = defn.crossAll().value() / defn.groupAll().value();
        percentText = g.selectAll('.percent').text(percentFmt(percent));

        var path = barPath(defn.groups());
        g.selectAll('.bar')
            .attr('d', path);
      });

      function barPath(groups) {
        var path = [],
            i = -1,
            n = groups.length,
            d;
        while (++i < n) {
          d = groups[i];
          path.push('M', x(d.key), ',', height, 'V', y(d.value),
                    'h', binWidth - 1, 'V', height);
        }
        return path.join('');
      }

      function resizePath(d) {
        var e = +(d === 'e'),
            x = e ? 1 : -1,
            y = height / 3;
        return 'M' + (0.5 * x) + ',' + y +
              'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6) +
              'V' + (2 * y - 6) +
              'A6,6 0 0 ' + e + ' ' + (0.5 * x) + ',' + (2 * y) +
              'Z' +
              'M' + (2.5 * x) + ',' + (y + 8) +
              'V' + (2 * y - 8) +
              'M' + (4.5 * x) + ',' + (y + 8) +
              'V' + (2 * y - 8);
      }
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
            .rangeRound([0, defn.numGroups() * binWidth]);
      }
      axis.scale(x);
      brush.x(x);
      width = x.range()[1];
      if (defn.ticks || defn.tickSpacing) {
        ticks = defn.ticks || Math.round(width / defn.tickSpacing);
        axis.ticks(ticks);
      }
      chartWidth = width + margin.right + margin.left;
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

    defn.addChart(chart);

    return d3.rebind(chart, brush, 'on');
  }

}(window.binfo));

