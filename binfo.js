
(function() {

  function getterSetter(my, names) {
    if (!Array.isArray(names)) names = [names];
    var getSets = names.map(function(name) {
      return [my, '.', name, ' = function(_) {',
              'if (!arguments.length) return ', name, ';',
              name, ' = _; return ', my, '; };'].join('');
    });
    return getSets.join('\n');
  }



  var chart,
      all,
      cross,
      holder,
      currentDataName,
      chartMap,
      currentChartIds = [],
      currentFilters = {},
      dataSets = {};

  var formatNumber = d3.format(',d');

  window.setHolder = function(_) {
    holder = d3.select(_);

    // Create skeleton.
    var config = holder.append('div')
        .attr('class', 'configuration');
    config.append('select')
        .attr('class', 'dataName');

    config.append('select')
        .attr('class', 'chartIds')
        .attr('multiple', 'multiple');

    config.append('input')
        .attr('type', 'button')
        .attr('value', 'Update')
        .on('click', function() {
          var charts = [];
          holder.selectAll('.chartIds option').each(function() {
            if (this.selected) {
              charts.push(this.value);
            }
          });
          var dataName = holder.select('.dataName').property('value');
          renderCharts(dataName, charts);
        });

    holder.append('div')
        .attr('class', 'charts');

    var totals = holder.append('aside')
        .attr('class', 'totals');
    totals.append('span')
        .attr('class', 'active')
        .text('-');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total');
  };

  window.changeDataName = function() {
    var dataName = holder.select('.dataName').property('value');
    var options = holder.select('.chartIds').selectAll('option')
        .data(dataSets[dataName].chartIds);
    options.enter().append('option');
    options
        .attr('value', function(d) { return d; })
        .text(function(d) { return d; });
  };

  window.dataSet = function(dataName, charts, data) {
    var chartMap = {};
    charts.forEach(function(chart) { chartMap[chart.id()] = chart; });
    dataSets[dataName] = {charts: chartMap, data: data,
                          chartIds: charts.map(function(d) { return d.id(); })};
    holder.select('.dataName').append('option')
        .attr('value', dataName)
        .text(dataName);
    if (holder.selectAll('.dataName option').length <= 1) {
      changeDataName();
    }
  };

  window.renderCharts = function(dataName, chartIds, filters) {

    var data = dataSets[dataName].data;
    chartMap = dataSets[dataName].charts;
    var charts = chartIds.map(function(id) { return chartMap[id]; });

    var removed = currentChartIds.filter(function(id) {
      return chartIds.indexOf(id) < 0;
    });
    var added = chartIds.filter(function(id) {
      return currentChartIds.indexOf(id) < 0;
    });

    if (!cross || currentDataName !== dataName || removed.length) {
      cross = crossfilter(data);
      added = chartIds;
    }
    currentChartIds = chartIds;
    currentDataName = dataName;
    currentFilters = filters;

    added.forEach(function(id) { chartMap[id].computeCross(); });

    filters = filters || {};
    chartIds.forEach(function(id) {
      if (filters[id]) {
        chartMap[id].filter(filters[id]);
      }
    });

    all = cross.groupAll();


    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.
    chart = holder.select('.charts').selectAll('.chart')
        .data(charts, function(d) { return d.id(); });

    chart.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chart.exit().remove();

    chart.each(function(ch) {
      ch.on('brush', renderAll).on('brushend', renderAll);
    });

    holder.select('.total')
        .text(formatNumber(cross.size()) + ' ' + dataName + ' selected.');

    renderAll();
  };

  window.filter = function(id, range) {
    chartMap[id].filter(range);
    renderAll();
  };

  window.reset = function(id) {
    chartMap[id].filter(null);
    renderAll();
  };

  // Renders the specified chart.
  function render(chart) {
    d3.select(this).call(chart);
  }

  // Whenever the brush moves, re-rendering everything.
  function renderAll() {
    chart.each(render);
    d3.select('.active').text(formatNumber(all.value()));
  }

  window.barChart = function barChart() {

    var margin = {top: 10, right: 10, bottom: 20, left: 10},
        binWidth = 10,
        x,
        y = d3.scale.linear().range([100, 0]),
        separation,
        id,
        axis = d3.svg.axis().orient('bottom'),
        brush = d3.svg.brush(),
        brushDirty,
        dimension,
        computeDimension,
        group,
        computeGroup,
        label,
        round;

    function chart(div) {
      var min, max,
          height = y.range()[0],
          groups = group.all();

      y.domain([0, group.top(1)[0].value]);

      if (!x) {
        min = groups[0].key;
        max = groups[groups.length - 1].key + separation;
        x = d3.scale.linear()
            .domain([min, max])
            .rangeRound([0, (max - min) / separation * binWidth]);
        axis.scale(x);
        brush.x(x);
      }
      var width = x.range()[1];
      var chartWidth = width + margin.right + margin.left;

      div.each(function() {
        var div = d3.select(this),
            g = div.select('g');

        // Create the skeletal chart.
        if (g.empty()) {
          div.attr('width', chartWidth);
          div.select('.title')
              .text(label)
            .append('input')
              .attr('type', 'button')
              .attr('value', 'reset')
              .on('click', function() { reset(id); })
              .attr('class', 'reset')
              .style('display', 'none');

          g = div.append('svg')
              .attr('width', chartWidth)
              .attr('height', height + margin.top + margin.bottom)
            .append('g')
              .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

          g.append('clipPath')
              .attr('id', 'clip-' + id)
            .append('rect')
              .attr('width', width)
              .attr('height', height);

          g.selectAll('.bar')
              .data(['background', 'foreground'])
            .enter().append('path')
              .attr('class', function(d) { return d + ' bar'; });

          g.selectAll('.foreground.bar')
              .attr('clip-path', 'url(#clip-' + id + ')');

          g.append('g')
              .attr('class', 'axis')
              .attr('transform', 'translate(0,' + height + ')')
              .call(axis);

          // Initialize the brush component with pretty resize handles.
          var gBrush = g.append('g').attr('class', 'brush').call(brush);
          gBrush.selectAll('rect').attr('height', height);
          gBrush.selectAll('.resize').append('path').attr('d', resizePath);
        }

        // Only redraw the brush if set externally.
        if (brushDirty) {
          brushDirty = false;
          g.selectAll('.brush').call(brush);
          div.select('.reset').style('display', brush.empty() ? 'none' : null);
          if (brush.empty()) {
            g.selectAll('#clip-' + id + ' rect')
                .attr('x', 0)
                .attr('width', width);
          } else {
            var extent = brush.extent();
            g.selectAll('#clip-' + id + ' rect')
                .attr('x', x(extent[0]))
                .attr('width', x(extent[1]) - x(extent[0]));
          }
        }

        g.selectAll('.bar')
            .datum(groups)
            .attr('d', barPath);
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
        var e = +(d == 'e'),
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
      div.select('.reset').style('display', null);
    });

    brush.on('brush.chart', function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (round) g.select('.brush')
          .call(brush.extent(extent = extent.map(round)))
        .selectAll('.resize')
          .style('display', null);
      g.select('#clip-' + id + ' rect')
          .attr('x', x(extent[0]))
          .attr('width', x(extent[1]) - x(extent[0]));
      dimension.filterRange(extent);
    });

    brush.on('brushend.chart', function() {
      if (brush.empty()) {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select('.reset').style('display', 'none');
        div.select('#clip-' + id + ' rect').attr('x', null).attr('width', '100%');
        dimension.filterAll();
      }
    });

    eval(getterSetter('chart', ['id', 'margin', 'y', 'separation', 'binWidth',
                                'round', 'label']));

    chart.computeCross = function() {
      dimension = cross.dimension(computeDimension);
      group = computeGroup ? dimension.group(computeGroup) : dimension.group();
    };

    chart.dimension = function(_) {
      if (!arguments.length) return computeDimension;
      computeDimension = _;
      return chart;
    };

    chart.group = function(_) {
      if (!arguments.length) return computeGroup;
      computeGroup = _;
      return chart;
    };

    chart.x = function(_) {
      if (!arguments.length) return x;
      x = _;
      axis.scale(x);
      brush.x(x);
      return chart;
    };

    chart.groupBy = function(groupBy) {
      computeGroup = function(d) { return Math.floor(d / groupBy) * groupBy; };
      separation = groupBy;
      return chart;
    };

    chart.filter = function(_) {
      if (_) {
        brush.extent(_);
        dimension.filterRange(_);
      } else {
        brush.clear();
        dimension.filterAll();
      }
      brushDirty = true;
      return chart;
    };

    return d3.rebind(chart, brush, 'on');
  };
})();

