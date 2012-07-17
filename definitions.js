
(function(binfo) {

  "use strict";

  function binfoDefinitions(chartsMe) {

    var definitions = {};

    definitions.binfoUnit = function(spec) {
      var defn = unitDefinition(spec);
      defn.chart = chartsMe.barChart(defn, spec);
      return defn;
    };

    definitions.binfoCompare = function(spec) {
      var defn = compareDefinition(spec);
      defn.chart = chartsMe.compareChart(defn, spec);
      return defn;
    };


    function unitDefinition(spec) {

      var chart,
          filterRange = [0, 0],
          filterActive,
          crossAll,
          dimension,
          dimensionFunc,
          internalDimensionFunc,
          group,
          groups,
          groupFromIndex,
          groupFunc,
          groupAll,
          ordinal = [],
          indexFromOrdinal = {},
          ordinalOrdered,
          ordinalHash = {},
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
        return Math.round((maxX - minX) / separation);
      };

      me.groupIndex = function(val) {
        return Math.floor((val - minX) / separation);
      };

      me.groupFromIndex = function(index) {
        return groupFromIndex[index];
      };

      me.data = function(data) {
        var ordinalCount = 1e9,
            orderFromOrdinal = {},
            ord,
            ordArray = [];

        if (me.ordinal) {
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
        chart.filter(_);
        return me;
      };

      me.setCross = function(cross, all) {
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
        groupFromIndex = [];
        groups.forEach(function(g) {
          groupFromIndex[me.groupIndex(g.value)] = g;
        });
        groupAll = dimension.groupAll();
        if (!spec.minX) {
          minX = groups[0].key;
        }
        if (!spec.maxX) {
          maxX = groups[groups.length - 1].key + separation;
        }
        chart.setCross();
      };

      me.setChart = function(_) {
        chart = _;
      };

      me.update = function() {
        if (!spec.maxY) {
          maxY = group.top(1)[0].value;
        }
      };

      return me;
    }

    definitions.compareIdFromRaw = function(rawId) {
      var ids = rawId.split('*');
      if (ids[0] < ids[1]) {
        return ids[0] + '*' + ids[1];
      }
      return ids[1] + '*' + ids[0];
    };

    function compareDefinition(spec) {

      var ids = spec.id.split('*'),
          xb = spec.binfos[ids[0]],
          yb = spec.binfos[ids[1]],
          normalize = spec.raw.split('*')[2],
          xbDimensionFunc,
          ybDimensionFunc,
          xbGroupFunc,
          ybGroupFunc,
          xbNumGroups,
          ybNumGroups,
          ybScale = Math.pow(2, 20),  // About a million
          dimensionFunc,
          group,
          groups,
          values,
          chart,
          me = {};


      me.id = spec.id;
      me.xb = xb;
      me.yb = yb;
      me.label = 'Comparing ' + xb.label + ' and ' + yb.label;
      me.ybScale = ybScale;
      me.group = function() { return group; };
      me.groups = function() { return groups; };
      me.values = function() { return values; };
      me.normalize = function(_) {
        if (!arguments.length) return normalize;
        normalize = _;
      };
      me.rawId = function() {
        return spec.id + (normalize ? '*' + normalize : '');
      };

      dimensionFunc = function(d) {
        var x = xb.groupIndex(xbGroupFunc(xbDimensionFunc(d))),
            y = yb.groupIndex(ybGroupFunc(ybDimensionFunc(d)));
        return x + y * ybScale;
      };



      me.addBinfoIds = function(binfoIds) {
        if (binfoIds.indexOf(xb.id) < 0) {
          binfoIds.push(xb.id);
        }
        if (binfoIds.indexOf(yb.id) < 0) {
          binfoIds.push(yb.id);
        }
      };

      me.setCross = function(cross, crossAll) {
        xbDimensionFunc = xb.dimensionFunc();
        ybDimensionFunc = yb.dimensionFunc();
        xbGroupFunc = xb.groupFunc();
        ybGroupFunc = yb.groupFunc();
        xbNumGroups = xb.numGroups();
        ybNumGroups = yb.numGroups();
        var dimension = cross.dimension(dimensionFunc);
        group = dimension.group();
        groups = group.all();
        var i;
        values = [];
        for (i = 0; i < xbNumGroups; i++) {
          values[i] = [];
        }
        chart.setCross();
      };

      me.update = function() {
        var xi,
            yi,
            i,
            n = groups.length,
            d,
            max;
        for (xi = 0; xi < xbNumGroups; xi++) {
          for (yi = 0; yi < ybNumGroups; yi++) {
            values[xi][yi] = 0;
          }
        }
        i = -1;
        while (++i < n) {
          d = groups[i];
          xi = d.key % ybScale;
          yi = Math.round(d.key / ybScale);
          values[xi][yi] = d.value;
        }
        if (!normalize) {
          max = group.top(1)[0].value + 1e-300;
          for (xi = 0; xi < xbNumGroups; xi++) {
            for (yi = 0; yi < ybNumGroups; yi++) {
              values[xi][yi] = values[xi][yi] / max;
            }
          }
        } else if (normalize === 'x') {
          for (yi = 0; yi < ybNumGroups; yi++) {
            max = 1e-300;
            for (xi = 0; xi < xbNumGroups; xi++) {
              max = Math.max(max, values[xi][yi]);
            }
            for (xi = 0; xi < xbNumGroups; xi++) {
              values[xi][yi] = values[xi][yi] / max;
            }
          }
        } else {
          for (xi = 0; xi < xbNumGroups; xi++) {
            max = 1e-300;
            for (yi = 0; yi < ybNumGroups; yi++) {
              max = Math.max(max, values[xi][yi]);
            }
            for (yi = 0; yi < ybNumGroups; yi++) {
              values[xi][yi] = values[xi][yi] / max;
            }
          }
        }
      };


      me.setChart = function(_) {
        chart = _;
      };


      return me;
    }


    return definitions;

  }


  binfo._register('definitions', binfoDefinitions, ['charts']);

}(window.binfo));

