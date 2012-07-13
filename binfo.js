
(function() {

  //"use strict";

  var binfo = {numGroups: 30};
  var chartMe = binfoCharts(binfo);
  var setupMe = binfoSetup(binfo, chartMe);
  hashRetrieval(binfo);
  rendering(binfo, setupMe);

  window.binfo = binfo;


  function binfoSetup(binfo, chartMe) {

    var holder,
        renderLater,
        dataSets = {},
        me = {};

    me.holder = function() { return holder; };
    me.renderLater = function(_) {
      if (!arguments.length) return renderLater;
      renderLater = _;
    };
    me.dataSets = function() { return dataSets; };

    binfo.holder = function(_) {
      holder = d3.select(_);

      // Create skeleton.
      var config = holder.append('div')
          .attr('class', 'configuration');
      config.append('select')
          .attr('class', 'dataName')
          .on('change', changeDataName);

      config.append('select')
          .attr('class', 'chartIds')
          .attr('multiple', 'multiple');

      config.append('div')
          .text('Update')
          .attr('class', 'button')
          .on('click', function() {
            var charts = [];
            holder.selectAll('.chartIds option').each(function() {
              if (this.selected) {
                charts.push(this.value);
              }
            });
            var dataName = holder.select('.dataName').property('value');
            binfo.render(dataName, charts);
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

    binfo.definitionsFromJSON = function(dataName, definitions) {
      var id, defn,
          evil = [],
          evalParts = ['dimension', 'group', 'x', 'y', 'round'];
      for (id in definitions) {
        if (definitions.hasOwnProperty(id)) {
          defn = definitions[id];
          evalParts.forEach(function(part) {
            if (!defn[part]) {
              return;
            }
            evil = evil.concat(['definitions["', id, '"].', part,
                                ' = ', defn[part], ';']);
          });
          if (defn.type && defn.type.slice(0, 8) === 'function') {
            evil = evil.concat(['definitions["', id, '"].type = ',
                                defn.type, ';']);
          }
        }
      }
      eval(evil.join(''));
      binfo.definitions(dataName, definitions);
    };

    binfo.definitions = function(dataName, definitions) {
      var binfos = {},
          binfoIds = [],
          id;
      for (id in definitions) {
        if (definitions.hasOwnProperty(id)) {
          definitions[id].id = id;
          binfoIds.push(id);
          binfos[id] = chartMe.binfoUnit(definitions[id]);
        }
      }
      dataSets[dataName] = dataSets[dataName] || {};
      dataSets[dataName].binfos = binfos;
      dataSets[dataName].binfoIds = binfoIds;
      holder.select('.dataName').append('option')
          .attr('value', dataName)
          .text(dataName);
      if (holder.selectAll('.dataName option').length <= 1) {
        changeDataName();
      }
      if (dataSets[dataName].dataUntyped) {
        binfo.dataFromUntyped(dataName, dataSets[dataName].dataUntyped);
      }
    };

    function changeDataName() {
      var dataName = holder.select('.dataName').property('value');
      var options = holder.select('.chartIds').selectAll('option')
          .data(dataSets[dataName].binfoIds);
      options.enter().append('option');
      options
          .attr('value', function(d) { return d; })
          .text(function(d) { return d; });
      options.exit().remove();
    };

    binfo.dataFromUntyped = function(dataName, data) {
      if (!(dataSets[dataName] && dataSets[dataName].binfos)) {
        dataSets[dataName] = {dataUntyped: data};
        return;
      }
      var binfos = dataSets[dataName].binfos,
          ids = dataSets[dataName].binfoIds,
          unit;
      data.forEach(function(d) {
        ids.forEach(function(id) {
          unit = binfos[id];
          if (unit.derived) {
            return;
          }
          if (typeof unit.type === 'function') {
            d[id] = unit.type(d[id]);
          } else if (unit.type === 'number') {
            d[id] = +d[id];
          }
        });
      });
      binfo.data(dataName, data);
    };

    binfo.data = function(dataName, data) {
      dataSets[dataName] = dataSets[dataName] || {};
      dataSets[dataName].data = data;
      if (renderLater && renderLater[0] === dataName) {
        binfo.render.apply(null, renderLater);
        renderLater = null;
      }
    };

    return me;
  }


  function hashRetrieval(binfo) {

    // Yarin's answer on this SO post:
    // http://stackoverflow.com/questions/4197591/
    // parsing-url-hash-fragment-identifier-with-javascript
    function getHashParams() {
      var hashParams = {};
      var e,
          a = /\+/g,  // Regex for replacing addition symbol with a space
          r = /([^&;=]+)=?([^&;]*)/g,
          d = function (s) { return decodeURIComponent(s.replace(a, ' ')); },
          q = window.location.hash.substring(1);

      e = r.exec(q);
      while (e) {
        hashParams[d(e[1])] = d(e[2]);
        e = r.exec(q);
      }
      return hashParams;
    }

    function renderFromHash() {
      var params = getHashParams();
      var dataName = params.data,
          charts = params.charts && params.charts.split(','),
          filters = params.filters && params.filters.split(',');

      var myFilters = {};
      if (filters) {
        filters.forEach(function(f) {
          var filterMap = f.split('*');
          myFilters[filterMap[0]] = filterMap.slice(1);
        });
      }
      if (!dataName) {
        return false;
      }
      binfo.render(dataName, charts, myFilters);
      return true;
    };

    window.onhashchange = renderFromHash;

    binfo.renderFromHash = renderFromHash;

  }


  function rendering(binfo, setupMe) {

    var chartSelection,
        cross,
        crossAll,
        binfos,
        currentDataName,
        currentHash,
        hashUpdatedRecently = false,
        hashNeedsUpdated = false,
        currentChartIds = [],
        currentFilters = {},
        formatNumber = d3.format(',d');


    binfo.render = function(dataName, binfoIds, filters) {

      var dataSets = setupMe.dataSets(),
          holder = setupMe.holder();

      if (!(dataSets[dataName] && dataSets[dataName].data &&
            dataSets[dataName].binfos)) {
        setupMe.renderLater([dataName, binfoIds, filters]);
        return;
      }

      filters = filters || {};
      var data = dataSets[dataName].data;
      binfos = dataSets[dataName].binfos;

      var charts = binfoIds.map(function(id) { return binfos[id]; });

      var removed = currentChartIds.filter(function(id) {
        return binfoIds.indexOf(id) < 0;
      });
      var added = binfoIds.filter(function(id) {
        return currentChartIds.indexOf(id) < 0;
      });

      if (!cross || currentDataName !== dataName || removed.length) {
        cross = crossfilter(data);
        crossAll = cross.groupAll();
        added = binfoIds;
      }
      currentChartIds = binfoIds;
      currentDataName = dataName;
      currentFilters = filters;

      updateHash();

      added.forEach(function(id) { binfos[id].setCross(cross, crossAll); });

      if (added.length || removed.length) {

        chartSelection = holder.select('.charts').selectAll('.chart')
            .data(charts, function(d) { return d.id; });

        chartSelection.enter()
          .append('div')
            .attr('class', 'chart')
          .append('div')
            .attr('class', 'title');

        chartSelection.exit().remove();

        chartSelection.order();

        holder.select('.total')
            .text(formatNumber(cross.size()) + ' ' + dataName + ' selected.');

        renderAll();
      }


      binfoIds.forEach(function(id) {
        if (filters[id]) {
          binfos[id].filter(filters[id]);
        } else {
          binfos[id].filter(null);
        }
      });

      renderAll();

    };

    function updateHash() {
      var filter, filterData,
          chartString = 'charts=' + currentChartIds.join(','),
          filterString = 'filters=',
          filterArray = [];
      for (filter in currentFilters) {
        if (currentFilters.hasOwnProperty(filter) && currentFilters[filter]) {
          filterData = currentFilters[filter].map(function(d) {
            if (typeof d === 'object') {
              d = d.valueOf();
            }
            return encodeURIComponent(d);
          }).join('*');
          filterArray.push(filter + '*' + filterData);
        }
      }
      filterString += filterArray.join(',');
      var params = ['data=' + currentDataName, chartString, filterString].join('&');
      currentHash = '#' + params;
      hashNeedsUpdated = true;
      if (!hashUpdatedRecently) {
        updateWindowHash();
      }
    }

    function updateWindowHash() {
      hashUpdatedRecently = false;
      if (hashNeedsUpdated) {
        window.history.replaceState({}, '', currentHash);
        setTimeout(updateWindowHash, 300);
        hashUpdatedRecently = true;
        hashNeedsUpdated = false;
      }
    }

    binfo.filter = function(id, range) {
      currentFilters[id] = range;
      binfos[id].filter(range);
      renderAll();
      updateHash();
    };

    // Renders the specified chart.
    function render(chart) {
      d3.select(this).call(chart.chart);
    }

    // Whenever the brush moves, re-rendering everything.
    function renderAll() {
      chartSelection.each(render);
      d3.select('.active').text(formatNumber(crossAll.value()));
    }

  }


  function binfoCharts(binfo) {

    var chartMe = {};

    chartMe.binfoUnit = function(spec) {
      var defn = binfoDefinition(spec);
      defn.chart = chartCreator(defn, spec);
      return defn;
    }

    function binfoDefinition(spec) {

      var charts = [],
          filterRange = [0, 0],
          filterActive,
          crossAll,
          dimension,
          dimensionFunc,
          group,
          groupFunc,
          groupAll,
          separation;

      function groupFuncBy(groupBy) {
        return function(d) { return Math.floor(d / groupBy) * groupBy; };
      }

      if (spec.groupBy) {
        separation = spec.groupBy;
        groupFunc = groupFuncBy(separation);
      } else {
        if (spec.groupIdentity) {
          groupFunc = function(d) { return d; };
        } else {
          groupFunc = spec.group;
        }
        separation = spec.separation;
      }

      if (spec.dimension) {
        dimensionFunc = spec.dimension;
      } else {
        dimensionFunc = function(d) { return d[spec.id]; };
      }

      var me = {};

      me.id = spec.id;
      me.label = spec.label;
      me.round = spec.round;
      me.type = spec.type;
      me.derived = spec.derived;

      me.dimensionFunc = function() { return dimensionFunc; };
      me.groupFunc = function() { return groupFunc; };
      me.separation = function() { return separation; };
      me.crossAll = function() { return crossAll; };
      me.group = function() { return group; };
      me.groupAll = function() { return groupAll; };
      me.filterActive = function() { return filterActive; };
      me.filterRange = function() { return filterRange; };

      me.filter = function(_) {
        if (_) {
          filterActive = true;
          filterRange = _;
          if (+_[0] === +_[1]) {
            dimension.filterExact(_[0]);
          } else {
            dimension.filterRange(_);
          }
        } else {
          filterActive = false;
          dimension.filterAll();
        }
        charts.forEach(function(c) { c.filter(_); });
        return me;
      };

      me.setCross = function(cross, all) {
        crossAll = all;
        dimension = cross.dimension(dimensionFunc);
        if (!groupFunc) {
          var top = dimension.top(Infinity),
              max = +dimensionFunc(top[0]),
              min = +dimensionFunc(top[top.length - 1]),
              domain = Math.abs(max - min),
              scale = d3.scale.linear().domain([0, domain]),
              ticks = scale.ticks(spec.numGroups || binfo.numGroups);

          separation = ticks[1] - ticks[0];
          groupFunc = groupFuncBy(separation);
        }
        group = dimension.group(groupFunc);
        groupAll = dimension.groupAll();
      };

      me.addChart = function(chart) {
        if (charts.indexOf(chart) === -1) {
          charts.push(chart);
        }
      };

      me.removeChart = function(chart) {
        charts.splice(charts.indexOf(chart), 1);
      };

      return me;
    }

    function chartCreator(defn, spec) {

      var margin = spec.margin || {top: 20, right: 10, bottom: 20, left: 10},
          binWidth = spec.binWidth || 10,
          x = spec.x,
          y = spec.y || d3.scale.linear().range([100, 0]),
          axis = d3.svg.axis().orient('bottom'),
          brush = d3.svg.brush(),
          percentFmt = d3.format('.3p'),
          brushDirty;

      function chart(div) {
        var min, max,
            height = y.range()[0],
            groups = defn.group().all();

        y.domain([0, defn.group().top(1)[0].value]);

        if (!x) {
          min = groups[0].key;
          max = groups[groups.length - 1].key + defn.separation();
          x = d3.scale.linear()
              .domain([min, max])
              .rangeRound([0, (max - min) / defn.separation() * binWidth]);
        }
        axis.scale(x);
        brush.x(x);
        var width = x.range()[1];
        var chartWidth = width + margin.right + margin.left;

        div.each(function() {
          var div = d3.select(this),
              g = div.select('g');

          // Create the skeletal chart.
          if (g.empty()) {
            div.attr('width', chartWidth);
            div.select('.title')
                .text(defn.label)

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
    };

    return chartMe;
  }

})();

