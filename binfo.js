
(function() {

  "use strict";


  var binfo = {
    numGroups: 35,
    tickSpacing: 44,
    chartDimensions: {
      top: 20,
      right: 10,
      bottom: 20,
      left: 10,
      height: 100,
      width: 100,
      binWidth: 12
    }
  };
  window.binfo = binfo;

  var components = {},
      componentNames = ['charts', 'definitions', 'setup',
                        'rendering', 'hashRetrieval'];

  binfo._register = function(name, component, deps) {
    var names = componentNames;
    if (components[name] || names.indexOf(name) < 0) {
      return;
    }
    components[name] = {component: component, dependencies: deps};
    if (names.some(function(c) { return !components[c]; })) {
      return;
    }
    binfo._register = null;
    var dependencies = {},
        compFuncs = {},
        completed = {};

    names.forEach(function(c) {
      dependencies[c] = components[c].dependencies;
      compFuncs[c] = components[c].component;
    });

    function notCompleted(c) {
      return !completed[c];
    }

    function completeLoop(name) {
      var func = compFuncs[name],
          deps = dependencies[name],
          compDeps,
          me;
      if (completed[name]) return;
      if (deps.some(notCompleted)) return;
      compDeps = deps.map(function(d) { return completed[d]; });
      me = compFuncs[name].apply(null, compDeps);
      completed[name] = me ? me : true;
    }

    while (names.some(notCompleted)) {
      names.forEach(completeLoop);
    }

  };



  function binfoSetup(definitionsMe) {

    var holder,
        renderLater,
        dataSets = {},
        me = {};

    me.holder = function() { return holder; };
    me.renderLater = function(_) {
      if (!arguments.length) return renderLater;
      renderLater = _;
    };
    me.dataSet = function(dataName) {
      var set = dataSets[dataName];
      if (!set || !set.complete) {
        return null;
      }
      return set;
    };

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
          evil.push('definitions["', id, '"].', part, ' = ', defn[part], ';');
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
          binfos[id] = definitionsMe.binfoUnit(definitions[id]);
        }
      }
      setDataSet(dataName, {binfos: binfos, binfoIds: binfoIds});
      holder.select('.dataName').append('option')
          .attr('value', dataName)
          .text(dataName);
      if (holder.selectAll('.dataName option').length <= 1) {
        changeDataName();
      }
    };

    function setDataSet(dataName, set) {
      var i,
          dataSet = dataSets[dataName] = dataSets[dataName] || {};

      for (i in set) {
        if (set.hasOwnProperty(i)) {
          dataSet[i] = set[i];
        }
      }
      if (dataSet.dataUntyped) {
        var dataUntyped = dataSet.dataUntyped;
        delete dataSet.dataUntyped;
        binfo.dataFromUntyped(dataName, dataUntyped);
        return;
      }
      if (dataSet.data && dataSet.binfos) {
        dataSet.complete = true;
        dataSet.compares = {};
        dataSet.binfoIds.forEach(function(b) {
          dataSet.binfos[b].data(dataSet.data);
        });
        if (renderLater && renderLater[0] === dataName) {
          binfo.render.apply(null, renderLater);
          renderLater = null;
        }
      }
    }

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
      setDataSet(dataName, {data: data});
    };

    return me;

  }

  binfo._register('setup', binfoSetup, ['definitions']);



  function hashRetrieval() {

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
          filters = params.filters && params.filters.split(','),
          compares = params.compares && params.compares.split(',');

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
      binfo.render(dataName, charts, myFilters, compares);
      return true;
    }

    window.onhashchange = renderFromHash;

    binfo.renderFromHash = renderFromHash;

  }

  binfo._register('hashRetrieval', hashRetrieval, []);


  function rendering(setupMe, definitionsMe) {

    var chartSelection,
        cross,
        crossAll,
        binfos,
        currentDataName,
        currentHash,
        hashUpdatedRecently = false,
        hashNeedsUpdated = false,
        currentChartIds = [],
        currentCompareIds = [],
        currentFilters = {},
        formatNumber = d3.format(',d');


    binfo.render = function(dataName, binfoIds, filters, compareIds) {

      var dataSet = setupMe.dataSet(dataName);

      if (!dataSet) {
        setupMe.renderLater([dataName, binfoIds, filters, compareIds]);
        return;
      }

      filters = filters || {};
      compareIds = compareIds || [];
      var data = dataSet.data,
          compares = dataSet.compares,
          addedCompares = [],
          holder = setupMe.holder();

      binfos = dataSet.binfos;

      var charts = binfoIds.map(function(id) { return binfos[id]; });
      compareIds.forEach(function(id) {
        if (!compares[id]) {
          compares[id] = definitionsMe.binfoCompare({id: id, binfos: binfos});
          addedCompares.push(id);
        }
        compares[id].addBinfoIds(binfoIds);
        charts.push(compares[id]);
      });

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
        addedCompares = compareIds;
      }
      currentChartIds = binfoIds;
      currentCompareIds = compareIds;
      currentDataName = dataName;
      currentFilters = filters;

      updateHash();

      added.forEach(function(id) { binfos[id].setCross(cross, crossAll); });
      addedCompares.forEach(function(id) { compares[id].setCross(cross, crossAll); });

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
          compareString = 'compares=' + currentCompareIds.join(','),
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
      var params = ['data=' + currentDataName, chartString,
                    compareString, filterString].join('&');
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

  binfo._register('rendering', rendering, ['setup', 'definitions']);

}());

