
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

  var chart, all;

  // Various formatters.
  var formatNumber = d3.format(",d"),
      formatChange = d3.format("+,d"),
      formatDate = d3.time.format("%B %d, %Y"),
      formatTime = d3.time.format("%I:%M %p");

  window.renderCharts = function(charts, cross) {

    all = cross.groupAll();

    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.
    chart = d3.selectAll(".chart")
        .data(charts)
        .each(function(chart) {
          chart.on("brush", renderAll).on("brushend", renderAll);
        });

    // Render the total.
    d3.selectAll("#total")
        .text(formatNumber(cross.size()));

    window.filter = function(filters) {
      filters.forEach(function(d, i) { charts[i].filter(d); });
      renderAll();
    };

    window.reset = function(i) {
      charts[i].filter(null);
      renderAll();
    };

    renderAll();
  };

  // Renders the specified chart.
  function render(method) {
    d3.select(this).call(method);
  }

  // Whenever the brush moves, re-rendering everything.
  function renderAll() {
    chart.each(render);
    d3.select("#active").text(formatNumber(all.value()));
  }

  window.barChart = function barChart() {
    if (!barChart.id) barChart.id = 0;

    var margin = {top: 10, right: 10, bottom: 20, left: 10},
        binWidth = 10,
        x,
        y = d3.scale.linear().range([100, 0]),
        separation,
        id = barChart.id++,
        axis = d3.svg.axis().orient("bottom"),
        brush = d3.svg.brush(),
        brushDirty,
        dimension,
        group,
        round;

    function chart(div) {
      var min, max,
          groups = group.all(),
          height = y.range()[0];

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
            g = div.select("g");

        // Create the skeletal chart.
        if (g.empty()) {
          div.attr("width", chartWidth);
          div.select(".title").append("a")
              .attr("href", "javascript:reset(" + id + ")")
              .attr("class", "reset")
              .text("reset")
              .style("display", "none");

          g = div.append("svg")
              .attr("width", chartWidth)
              .attr("height", height + margin.top + margin.bottom)
            .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

          g.append("clipPath")
              .attr("id", "clip-" + id)
            .append("rect")
              .attr("width", width)
              .attr("height", height);

          g.selectAll(".bar")
              .data(["background", "foreground"])
            .enter().append("path")
              .attr("class", function(d) { return d + " bar"; })
              .datum(group.all());

          g.selectAll(".foreground.bar")
              .attr("clip-path", "url(#clip-" + id + ")");

          g.append("g")
              .attr("class", "axis")
              .attr("transform", "translate(0," + height + ")")
              .call(axis);

          // Initialize the brush component with pretty resize handles.
          var gBrush = g.append("g").attr("class", "brush").call(brush);
          gBrush.selectAll("rect").attr("height", height);
          gBrush.selectAll(".resize").append("path").attr("d", resizePath);
        }

        // Only redraw the brush if set externally.
        if (brushDirty) {
          brushDirty = false;
          g.selectAll(".brush").call(brush);
          div.select(".title a").style("display", brush.empty() ? "none" : null);
          if (brush.empty()) {
            g.selectAll("#clip-" + id + " rect")
                .attr("x", 0)
                .attr("width", width);
          } else {
            var extent = brush.extent();
            g.selectAll("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));
          }
        }

        g.selectAll(".bar").attr("d", barPath);
      });

      function barPath(groups) {
        var path = [],
            i = -1,
            n = groups.length,
            d;
        while (++i < n) {
          d = groups[i];
          path.push("M", x(d.key), ",", height, "V", y(d.value),
                    "h", binWidth - 1, "V", height);
        }
        return path.join("");
      }

      function resizePath(d) {
        var e = +(d == "e"),
            x = e ? 1 : -1,
            y = height / 3;
        return "M" + (.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
      }
    }

    brush.on("brushstart.chart", function() {
      var div = d3.select(this.parentNode.parentNode.parentNode);
      div.select(".title a").style("display", null);
    });

    brush.on("brush.chart", function() {
      var g = d3.select(this.parentNode),
          extent = brush.extent();
      if (round) g.select(".brush")
          .call(brush.extent(extent = extent.map(round)))
        .selectAll(".resize")
          .style("display", null);
      g.select("#clip-" + id + " rect")
          .attr("x", x(extent[0]))
          .attr("width", x(extent[1]) - x(extent[0]));
      dimension.filterRange(extent);
    });

    brush.on("brushend.chart", function() {
      if (brush.empty()) {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select(".title a").style("display", "none");
        div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
        dimension.filterAll();
      }
    });

    eval(getterSetter('chart', ['margin', 'y', 'separation', 'binWidth',
                                'dimension', 'group', 'round']));

    chart.x = function(_) {
      if (!arguments.length) return x;
      x = _;
      axis.scale(x);
      brush.x(x);
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

    return d3.rebind(chart, brush, "on");
  }
})();
