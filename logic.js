
binfo._register('logic', [], function(logic) {

  "use strict";

  logic.barLogic = function(bar, spec, data) {

    var added = 0,
        updated,
        filterRange,
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
        indexFromOrdinal = {},
        ordinalOrdered,
        ordinalHash = {},
        minX = spec.minX,
        maxX = spec.maxX,
        maxY = spec.maxY,
        separation = spec.separation;


    bar.api.id = spec.id;
    bar.round = spec.round;

    function groupFuncBy(groupBy) {
      return function(d) { return Math.floor(d / groupBy) * groupBy; };
    }

    dimensionFunc = spec.dimension || function(d) { return d[bar.api.id]; };
    if (spec.ordinal) {
      separation = 1;
      bar.round = Math.round;
      if (Array.isArray(spec.ordinal)) {
        spec.ordinal.forEach(function(o, i) { ordinalHash[o] = i; });
      } else {
        ordinalHash = spec.ordinal;
      }
      if (typeof ordinalHash === 'object') {
        ordinalOrdered = function(d) {
          var order = ordinalHash[d];
          if (!order && order !== 0) {
            return -1;
          }
          return order;
        };
      } else if (typeof spec.ordinal === 'function') {
        ordinalOrdered = spec.ordinal;
      } else {
        ordinalOrdered = function() { return -1; };
      }
      internalDimensionFunc = dimensionFunc;
      dimensionFunc = function(d) {
        return indexFromOrdinal[internalDimensionFunc(d)];
      };
    }

    if (spec.group) {
      groupFunc = spec.group;
    } else if (spec.groupBy) {
      separation = spec.separation || spec.groupBy;
      groupFunc = groupFuncBy(separation);
    } else if (spec.groupIdentity || spec.ordinal) {
      groupFunc = function(d) { return d; };
    }

    if (spec.ordinal) {
      bar.ordinal = function() { return ordinal; };
    }

    bar.api.dimensionFunc = function() { return dimensionFunc; };
    bar.api.groupFunc = function() { return groupFunc; };

    bar.groups = function() { return groups; };
    bar.minX = function() { return minX; };
    bar.maxX = function() { return maxX; };
    bar.maxY = function() { return maxY; };
    bar.filterActive = function() { return filterActive; };
    bar.filterRange = function() { return filterRange; };

    bar.percent = function() {
      return crossAll.value() / groupAll.value();
    };

    bar.api.numGroups = function() {
      return Math.round((maxX - minX) / separation);
    };

    bar.api.groupIndex = function(val) {
      return Math.floor((val - minX) / separation);
    };

    function setData(data) {
      var ordinalCount = 1e9,
          orderFromOrdinal = {},
          ord,
          ordArray = [];

      if (bar.ordinal) {
        data.forEach(function(d) {
          d = internalDimensionFunc(d);
          var order = orderFromOrdinal[d];
          if (typeof order !== 'undefined') {
            return;
          }
          order = ordinalOrdered(d);
          if (order >= 0) {
            orderFromOrdinal[d] = order;
            return;
          }
          orderFromOrdinal[d] = ordinalCount;
          ordinalCount++;
        });
        for (ord in orderFromOrdinal) {
          if (orderFromOrdinal.hasOwnProperty(ord)) {
            ordArray.push({value: ord, order: orderFromOrdinal[ord]});
          }
        }
        ordArray.sort(function(a, b) { return a.order - b.order; });
        ordArray.forEach(function(d, i) {
          indexFromOrdinal[d.value] = i;
          ordinal[i] = d.value;
        });
      }
    };

    setData(data);

    bar.api.filter = function(range) {
      if (!arguments.length) {
        return filterActive ? filterRange : null;
      }
      if (range) {
        filterActive = true;
        if (range === true) {
          range = filterRange;
        } else {
          filterRange = range;
        }
        if (dimension) {
          if (+range[0] === +range[1]) {
            dimension.filterExact(range[0]);
          } else {
            dimension.filterRange(range);
          }
        }
      } else {
        filterActive = false;
        if (dimension) {
          dimension.filterAll();
        }
      }
      bar.chartFilter(range);
      return bar;
    };

    bar.api.add = function(cross, all) {
      added += 1;
      if (added > 1) {
        return;
      }
      crossAll = all;
      dimension = cross.dimension(dimensionFunc);
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
        minX = +groups[0].key;
      }
      if (!spec.maxX) {
        maxX = +groups[groups.length - 1].key + separation;
      }
      bar.addChart();
      if (!filterRange) {
        var ticks = bar.x.ticks(20),
            dummyLeft = ticks[Math.round(ticks.length * 0.3)],
            dummyRight = ticks[Math.round(ticks.length * 0.7)];
        if (bar.round) {
          dummyLeft = bar.round(dummyLeft);
          dummyRight = bar.round(dummyRight);
        }
        filterRange = [dummyLeft, dummyRight];
      }
      bar.api.filter(filterActive);
    };

    bar.api.remove = function() {
      added -= 1;
      if (!added) {
        filterActive = false;
      }
    };

    bar.api.update = function() {
      if (updated) return;
      updated = true;
      if (!spec.maxY) {
        maxY = group.top(1)[0].value;
      }
      bar.updateChart();
    };

    bar.api.resetUpdate = function() {
      if (!updated) return;
      updated = false;
      bar.resetUpdateChart();
    };

    bar.api.addToFilters = function(filters) {
      filters[bar.api.id] = bar.api.filter();
    };

  };


  logic.compareLogic = function(compare, spec) {

    var ids = spec.id.split('-'),
        xc = spec.charts[ids[0]],
        yc = spec.charts[ids[1]],
        given = null,
        xcDimensionFunc,
        ycDimensionFunc,
        xcGroupFunc,
        ycGroupFunc,
        xcNumGroups,
        ycNumGroups,
        ycScale = Math.pow(2, 20),  // About a million
        dimensionFunc,
        group,
        groups,
        values;

    compare.api.id = spec.id;

    compare.xc = xc;
    compare.yc = yc;
    compare.values = function() { return values; };

    compare.api.given = function(_) {
      if (!arguments.length) return given;
      given = _;
    };

    compare.api.filter = function(_) {
      compare.api.given(_ ? _[0] : null);
    };

    dimensionFunc = function(d) {
      var x = xc.groupIndex(xcGroupFunc(xcDimensionFunc(d))),
          y = yc.groupIndex(ycGroupFunc(ycDimensionFunc(d)));
      return x + y * ycScale;
    };

    compare.api.addToFilters = function(filters) {
      filters[compare.api.id] = given ? [given] : null;
      filters[xc.id] = xc.filter();
      filters[yc.id] = yc.filter();
    };

    compare.api.add = function(cross, crossAll) {
      xc.add(cross, crossAll);
      yc.add(cross, crossAll);
      xcDimensionFunc = xc.dimensionFunc();
      ycDimensionFunc = yc.dimensionFunc();
      xcGroupFunc = xc.groupFunc();
      ycGroupFunc = yc.groupFunc();
      xcNumGroups = xc.numGroups();
      ycNumGroups = yc.numGroups();
      var dimension = cross.dimension(dimensionFunc);
      group = dimension.group();
      groups = group.all();
      var i;
      values = [];
      for (i = 0; i < xcNumGroups; i++) {
        values[i] = [];
      }
      compare.addChart();
    };

    compare.api.remove = function() {
      xc.remove();
      yc.remove();
    };

    compare.api.update = function() {
      xc.update();
      yc.update();
      var xi,
          yi,
          i,
          n = groups.length,
          d,
          max;
      for (xi = 0; xi < xcNumGroups; xi++) {
        for (yi = 0; yi < ycNumGroups; yi++) {
          values[xi][yi] = 0;
        }
      }
      i = -1;
      while (++i < n) {
        d = groups[i];
        xi = d.key % ycScale;
        yi = Math.round(d.key / ycScale);
        values[xi][yi] = d.value;
      }
      if (!given) {
        max = group.top(1)[0].value + 1e-300;
        for (xi = 0; xi < xcNumGroups; xi++) {
          for (yi = 0; yi < ycNumGroups; yi++) {
            values[xi][yi] = values[xi][yi] / max;
          }
        }
      } else if (given === 'yc') {
        for (yi = 0; yi < ycNumGroups; yi++) {
          max = 1e-300;
          for (xi = 0; xi < xcNumGroups; xi++) {
            max = Math.max(max, values[xi][yi]);
          }
          for (xi = 0; xi < xcNumGroups; xi++) {
            values[xi][yi] = values[xi][yi] / max;
          }
        }
      } else {
        for (xi = 0; xi < xcNumGroups; xi++) {
          max = 1e-300;
          for (yi = 0; yi < ycNumGroups; yi++) {
            max = Math.max(max, values[xi][yi]);
          }
          for (yi = 0; yi < ycNumGroups; yi++) {
            values[xi][yi] = values[xi][yi] / max;
          }
        }
      }

      compare.updateChart();
    };

    compare.api.resetUpdate = function() {
      xc.resetUpdate();
      yc.resetUpdate();
    };

  };
});

