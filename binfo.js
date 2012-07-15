
(function() {

  "use strict";

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
      /*jshint evil:true */
      var id, defn,
          evil = [],
          evalParts = ['dimension', 'group', 'x', 'y', 'round'],
          evalPartsIfFunc = ['type', 'ordinal'];
      function makeEvil(defn, id) {
        return function(part) {
          if (!defn[part]) {
            return;
          }
          evil = evil.concat(['definitions["', id, '"].', part,
                              ' = ', defn[part], ';']);
        };
      }
      function maybeMakeEvil(defn, id) {
        var evalPart = makeEvil(defn, id);
        return function(part) {
          if (typeof defn[part] === 'string' &&
              defn[part].slice(0, 8) === 'function') {
            evalPart(part);
          }
        };
      }

      for (id in definitions) {
        if (definitions.hasOwnProperty(id)) {
          defn = definitions[id];
          evalParts.forEach(makeEvil(defn, id));
          evalPartsIfFunc.forEach(maybeMakeEvil(defn, id));
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
    }

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
            return;
          }
          switch (unit.type) {
          case 'number':
            d[id] = +d[id];
            break;
          case 'date':
            d[id] = new Date(d[id]);
            break;
          default:
            // string, so no modification needed
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
    }

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
      function filterEncode(d) {
        if (typeof d === 'object') {
          d = d.valueOf();
        }
        return encodeURIComponent(d);
      }
      for (filter in currentFilters) {
        if (currentFilters.hasOwnProperty(filter) && currentFilters[filter]) {
          filterData = currentFilters[filter].map(filterEncode).join('*');
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
      /*jshint validthis:true */
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
      defn.chart = binfo.charts.chartCreator(defn, spec);
      return defn;
    };

    function binfoDefinition(spec) {

      var charts = [],
          filterRange = [0, 0],
          filterActive,
          crossAll,
          dimension,
          dimensionFunc,
          internalDimensionFunc,
          group,
          groups,
          groupFunc,
          groupAll,
          ordinal = [],
          ordinalCount = 1e9,
          orderFromOrdinal = {},
          indexFromOrder,
          ordinalOrdered,
          minX = spec.minX,
          maxX = spec.maxX,
          maxY = spec.maxY,
          separation = spec.separation,
          me = {};


      me.id = spec.id;
      me.label = spec.label;
      me.round = spec.round;
      me.type = spec.type || 'number';
      me.derived = spec.derived;
      me.tickSpacing = spec.tickSpacing || binfo.tickSpacing;
      if (spec.tickSpacing === false) {
        me.tickSpacing = false;
      }
      me.ticks = spec.ticks;

      function groupFuncBy(groupBy) {
        return function(d) { return Math.floor(d / groupBy) * groupBy; };
      }

      dimensionFunc = spec.dimension || function(d) { return d[spec.id]; };
      if (spec.ordinal) {
        separation = 1;
        me.round = Math.round;
        if (typeof spec.ordinal === 'function') {
          ordinalOrdered = spec.ordinal;
        } else {
          ordinalOrdered = function() { return -1; };
        }
        //if (Array.isArray(spec.ordinal)) {
        //  ordinal = spec.ordinal;
        //  ordinal.forEach(function(o, i) {
        //    indexFromOrdinal[o] = i;
        //  });
        //}
        internalDimensionFunc = dimensionFunc;
        dimensionFunc = function(d) {
          d = internalDimensionFunc(d);
          var order = orderFromOrdinal[d];
          if (typeof order !== 'undefined') {
            return order;
          }
          var order = ordinalOrdered(d);
          if (order >= 0) {
            orderFromOrdinal[d] = order;
            return order;
          }
          orderFromOrdinal[d] = ordinalCount;
          return ordinalCount++;
        };
        groupFunc = function(d) { return indexFromOrder[d]; }
      }

      if (spec.group) {
        groupFunc = spec.group;
      } else if (spec.groupBy) {
        separation = spec.separation || spec.groupBy;
        groupFunc = groupFuncBy(separation);
      } else if (spec.groupIdentity) {
        groupFunc = function(d) { return d; };
      }

      if (spec.ordinal) {
        me.ordinal = function() { return ordinal; };
      }
      me.dimensionFunc = function() { return dimensionFunc; };
      me.groupFunc = function() { return groupFunc; };
      me.separation = function() { return separation; };
      me.crossAll = function() { return crossAll; };
      me.group = function() { return group; };
      me.groups = function() { return groups; };
      me.groupAll = function() { return groupAll; };
      me.minX = function() { return minX; };
      me.maxX = function() { return maxX; };
      me.maxY = function() { return maxY; };
      me.filterActive = function() { return filterActive; };
      me.filterRange = function() { return filterRange; };

      me.numGroups = function() {
        return (maxX - minX) / separation;
      };

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
        if (me.ordinal) {
          var ordinalAndIndex = computeIndexFromOrder(orderFromOrdinal);
          indexFromOrder = ordinalAndIndex[0];
          ordinal = ordinalAndIndex[1];
        }
        if (!groupFunc) {
          // Using d3.scale.linear to get a human-friendly way to
          // group the values into "numGroups"
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
        groups = group.all();
        groupAll = dimension.groupAll();
        if (!spec.minX) {
          minX = groups[0].key;
        }
        if (!spec.maxX) {
          maxX = groups[groups.length - 1].key + separation;
        }
        charts.forEach(function(c) { c.setCross(); });
      };

      function computeIndexFromOrder(sparse) {
        var ord,
            array = [],
            indexFromOrder = {},
            ordinal = [];
        for (ord in sparse) {
          if (sparse.hasOwnProperty(ord)) {
            array.push({value: ord, order: sparse[ord]})
          }
        }
        array.sort(function(a, b) { return a.order - b.order; });
        array.forEach(function(d, i) {
          indexFromOrder[d.order] = i;
          ordinal[i] = d.value;
        });
        return [indexFromOrder, ordinal];
      }

      me.addChart = function(chart) {
        if (charts.indexOf(chart) === -1) {
          charts.push(chart);
        }
      };

      me.removeChart = function(chart) {
        charts.splice(charts.indexOf(chart), 1);
      };

      me.update = function() {
        if (!spec.maxY) {
          maxY = group.top(1)[0].value;
        }
      };

      return me;
    }

    return chartMe;
  }


  var binfo = {numGroups: 35, tickSpacing: 44, binWidth: 12, chartHeight: 100};
  var chartMe = binfoCharts(binfo);
  var setupMe = binfoSetup(binfo, chartMe);
  hashRetrieval(binfo);
  rendering(binfo, setupMe);

  window.binfo = binfo;

}());

