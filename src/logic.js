
binfo._register('logic', ['hash'], function(logic, hash) {

  "use strict";

  function floorBy(number) {
    return function(d) { return Math.floor((d / number) + 1e-7) * number; };
  }

  function ceilBy(number) {
    return function(d) { return Math.ceil((d / number) - 1e-7) * number; };
  }

  function roundBy(number) {
    return function(d) { return Math.round(d / number) * number; };
  }

  function setClips(chart, number) {
    chart.round = roundBy(number);
    chart.floor = floorBy(number);
    chart.ceil = ceilBy(number);
  }

  logic.barLogic = function(bar, spec, data) {

    var added = 0,
        addedCross = 0,
        updated,
        filterRange,
        filterActive,
        crossAll,
        dimension,
        dimensionFunc,
        internalDimensionFunc,
        group,
        groups,
        rawGroups,
        groupFunc,
        groupAll,
        ordinal = [],
        indexFromOrdinal = {},
        ordinalOrdered,
        ordinalHash = {},
        format,
        minX = spec.minX,
        maxX = spec.maxX,
        maxY = spec.maxY,
        separation = spec.separation;


    bar.api.id = spec.id;
    bar.round = spec.round;
    bar.floor = spec.floor || spec.round;
    bar.ceil = spec.ceil || spec.ceil;


    if (bar.round && typeof bar.round === 'number') {
      setClips(bar, bar.round);
    }

    dimensionFunc = spec.dimension || function(d) { return d[bar.api.id]; };
    if (spec.ordinal) {
      separation = 1;
      setClips(bar, 1);
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
      format = spec.format || function(d) { return d; };
    }

    if (spec.group) {
      groupFunc = spec.group;
    } else if (spec.groupBy) {
      separation = separation || spec.groupBy;
      groupFunc = floorBy(separation);
    } else if (spec.groupIdentity || spec.ordinal) {
      groupFunc = function(d) { return d; };
    }

    if (spec.ordinal) {
      bar.ordinal = function() { return ordinal; };
      bar.api.ordinal = true;
    }

    bar.api.dimensionFunc = function() { return dimensionFunc; };
    bar.api.groupFunc = function() { return groupFunc; };
    bar.api.groups = function() { return groups; };

    bar.rawGroups = function() { return rawGroups; };
    bar.minX = function() { return minX; };
    bar.maxX = function() { return maxX; };
    bar.maxY = function() { return maxY; };
    bar.filterActive = function() { return filterActive; };
    bar.filterRange = function() { return filterRange; };

    bar.percent = function() {
      return crossAll.value() / groupAll.value();
    };

    bar.api.numGroups = function() {
      return groups.length;
    };

    bar.api.groupIndex = function(val) {
      return Math.round((val - minX) / separation);
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
          ordinal[i] = format(d.value);
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
      bar.chartFilter();
      return bar;
    };

    bar.api.addCross = function(cross, all) {
      addedCross += 1;
      if (addedCross > 1) {
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
        groupFunc = floorBy(separation);
      }
      group = dimension.group(groupFunc);
      rawGroups = group.all();
      groupAll = dimension.groupAll();
      if (!spec.minX) {
        minX = +rawGroups[0].key;
      }
      if (!spec.maxX) {
        maxX = +rawGroups[rawGroups.length - 1].key + separation;
      }

      // Fill in groups with empty groups when there is none
      var emptyGroup = {value: 0},
          r,
          g = 0,
          index,
          numGroups;
      groups = [];
      for (r = 0; r < rawGroups.length; r++) {
        index = bar.api.groupIndex(rawGroups[r].key);
        for (; g < index; g++) {
          groups.push(emptyGroup);
        }
        groups.push(rawGroups[r]);
        g += 1;
      }
      numGroups = Math.round((maxX - minX) / separation);
      for (; g < numGroups; g++) {
        groups.push(emptyGroup);
      }

      bar.api.filter(filterActive);
    };

    bar.api.add = function() {
      added += 1;
      bar.chartFilter();
      if (added > 1) {
        return;
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
    };

    bar.api.removeCross = function() {
      addedCross -= 1;
    };

    bar.api.remove = function() {
      added -= 1;
      if (!added) {
        bar.api.filter(null);
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

    bar.api.addToParams = function(params) {
      params.filter[bar.api.id] = bar.api.filter();
    };

  };


  logic.compareLogic = function(compare, spec) {

    var ids = spec.id.split('-'),
        xc = spec.charts[ids[0]],
        yc = spec.charts[ids[1]],
        given = null,
        crossAll,
        maxAll,
        xcDimensionFunc,
        ycDimensionFunc,
        xcGroupFunc,
        ycGroupFunc,
        xcNumGroups,
        ycNumGroups,
        xcGroups,
        ycGroups,
        levelsMatrix,
        levels = binfo.compareLevels,
        ycScale = Math.pow(2, 20),  // About a million
        dimensionFunc,
        filterRange,
        filterStats,
        filteredLevels,
        group,
        rawGroups,
        values;

    compare.api.id = spec.id;

    compare.xc = xc;
    compare.yc = yc;
    compare.levelsMatrix = function() { return levelsMatrix; };
    compare.xcNumGroups = function() { return xcNumGroups; };
    compare.ycNumGroups = function() { return ycNumGroups; };
    compare.filterStats = function() { return filterStats; };

    setClips(compare, 1);

    compare.api.given = function(_) {
      if (!arguments.length) return given;
      given = _;
    };

    compare.api.filter = function(_) {
      if (!arguments.length) return filterRange;
      if (_ && _.length === 4) {  // filter comes from hash
        filterRange = [[+_[0], +_[1]], [+_[2], +_[3]]];
      } else {
        filterRange = _;
      }
      filterStats = compare.stats(filterRange);
      hash.refreshParams();
      compare.chartFilter(filterRange);
    };

    compare.api.filterLevels = function(_) {
      if (!arguments.length) return filteredLevels;
      filteredLevels = _;
      hash.refreshParams();
      compare.chartLevels(_);
    };

    dimensionFunc = function(d) {
      var x = xc.groupIndex(xcGroupFunc(xcDimensionFunc(d))),
          y = yc.groupIndex(ycGroupFunc(ycDimensionFunc(d)));
      return x + y * ycScale;
    };

    compare.api.addToParams = function(params) {
      params.filterLevels[compare.api.id] = filteredLevels;
      params.given[compare.api.id] = given;
      var r = filterRange;
      // Convert from extent format to hash format.
      params.filter[compare.api.id] = r ? [r[0][0], r[0][1], r[1][0], r[1][1]] : null;
      params.filter[xc.id] = xc.filter();
      params.filter[yc.id] = yc.filter();
    };

    compare.api.addCross = function(cross, all) {
      crossAll = all;
      xc.addCross(cross, crossAll);
      yc.addCross(cross, crossAll);
      xcDimensionFunc = xc.dimensionFunc();
      ycDimensionFunc = yc.dimensionFunc();
      xcGroupFunc = xc.groupFunc();
      ycGroupFunc = yc.groupFunc();
      xcGroups = xc.groups();
      ycGroups = yc.groups();
      xcNumGroups = xc.numGroups();
      ycNumGroups = yc.numGroups();
      var dimension = cross.dimension(dimensionFunc);
      group = dimension.group();
      rawGroups = group.all();
      var i;
      values = [];
      levelsMatrix = [];
      for (i = 0; i < xcNumGroups; i++) {
        values[i] = [];
        levelsMatrix[i] = [];
      }
    };

    compare.api.add = function() {
      xc.add();
      yc.add();
      compare.addChart();
    };

    compare.api.remove = function() {
      xc.remove();
      yc.remove();
      compare.api.given(null);
      compare.api.filterLevels(null);
      compare.api.filter(null);
    };

    function passToXcYc(method) {
      compare.api[method] = function() {
        xc[method]();
        yc[method]();
      };
    }
    ['removeCross', 'resetUpdate'].forEach(function(pass) {
      passToXcYc(pass);
    });

    compare.api.update = function() {
      xc.update();
      yc.update();
      var xi,
          yi,
          i,
          n = rawGroups.length,
          d,
          normalizeLevels = levels - 1e-9,
          normalizeLog = normalizeLevels / 3,   // Three is the magic number
          val,
          log,
          level,
          normalize;
      for (xi = 0; xi < xcNumGroups; xi++) {
        for (yi = 0; yi < ycNumGroups; yi++) {
          values[xi][yi] = 0;
          levelsMatrix[xi][yi] = 0;
        }
      }
      i = -1;
      while (++i < n) {
        d = rawGroups[i];
        xi = d.key % ycScale;
        yi = Math.round(d.key / ycScale);
        values[xi][yi] = d.value;
      }
      if (!given) {
        normalize = normalizeLevels / (group.top(1)[0].value + 1e-300);
        for (xi = 0; xi < xcNumGroups; xi++) {
          for (yi = 0; yi < ycNumGroups; yi++) {
            levelsMatrix[xi][yi] = Math.floor(values[xi][yi] * normalize);
          }
        }
      } else if (given === 'yc') {
        for (yi = 0; yi < ycNumGroups; yi++) {
          normalize = xcNumGroups / (ycGroups[yi].value + 1e-300);
          for (xi = 0; xi < xcNumGroups; xi++) {
            val = values[xi][yi] * normalize;
            log = Math.log(1 + val) * normalizeLog;
            level = Math.min(levels - 1, Math.floor(log));
            levelsMatrix[xi][yi] = level;
          }
        }
      } else {
        for (xi = 0; xi < xcNumGroups; xi++) {
          normalize = ycNumGroups / (xcGroups[xi].value + 1e-300);
          for (yi = 0; yi < ycNumGroups; yi++) {
            val = values[xi][yi] * normalize;
            log = Math.log(1 + val) * normalizeLog;
            level = Math.min(levels - 1, Math.floor(log));
            levelsMatrix[xi][yi] = level;
          }
        }
      }

      filterStats = compare.stats(filterRange);
      compare.updateChart();
    };

    compare.stats = function(extent) {
      if (!extent) {
        return null;
      }
      var minXi = extent[0][0],
          minYi = extent[0][1],
          maxXi = extent[1][0],
          maxYi = extent[1][1],
          xi,
          yi,
          numXs,
          numYs,
          sum,
          rowTotal,
          rowHovered,
          levelsSum,
          hoveredArea,
          percent,
          level;
      sum = 0;
      levelsSum = 0;
      numXs = maxXi - minXi;
      numYs = maxYi - minYi;
      hoveredArea = numXs * numYs;
      for (xi = minXi; xi < maxXi; xi++) {
        for (yi = minYi; yi < maxYi; yi++) {
          sum += values[xi][yi];
          levelsSum += levelsMatrix[xi][yi];
        }
      }
      level = Math.round(levelsSum / hoveredArea);
      if (!given) {
        percent = sum / crossAll.value();
      } else if (given === 'yc') {
        sum = 0;
        for (yi = minYi; yi < maxYi; yi++) {
          rowTotal = ycGroups[yi].value;
          if (rowTotal) {
            rowHovered = 0;
            for (xi = minXi; xi < maxXi; xi++) {
              rowHovered += values[xi][yi] / rowTotal;
            }
          } else {
            rowHovered = numXs / xcNumGroups;
          }
          sum += rowHovered;
        }
        percent = sum / numYs;
      } else {
        sum = 0;
        for (xi = minXi; xi < maxXi; xi++) {
          rowTotal = xcGroups[xi].value;
          rowHovered = 0;
          if (rowTotal) {
            for (yi = minYi; yi < maxYi; yi++) {
              rowHovered += values[xi][yi] / rowTotal;
            }
          } else {
            rowHovered = numYs / ycNumGroups;
          }
          sum += rowHovered;
        }
        percent = sum / numXs;
      }
      return {level: level, percent: percent};
    };

  };
});

