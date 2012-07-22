
var binfo = {
  numGroups: 35,
  tickSpacing: 40,
  compareHeightScale: 0.20,
  chartDimensions: {
    top: 20,
    right: 10,
    bottom: 20,
    left: 10,
    height: 100,
    width: 100,
    binWidth: 11
  }
};


binfo._register = (function() {

  "use strict";

  var components = {},
      componentNames = ['logic', 'charts', 'setup',
                        'rendering', 'hashRetrieval'];

  return function(name, deps, component) {
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

}());


binfo._register('setup', ['charts'], function(chartsApi) {

  "use strict";

  var holder,
      renderLater,
      selected = [],
      dataSets = {},
      dataName,
      setupApi = {};

  setupApi.holder = function() { return holder; };
  setupApi.renderLater = function(_) {
    if (!arguments.length) return renderLater;
    renderLater = _;
  };
  setupApi.dataSet = function(dataName) {
    var set = dataSets[dataName];
    if (!set || !set.complete) {
      return null;
    }
    return set;
  };

  binfo.holder = function(_) {
    holder = d3.select(_);

    // Create skeleton.
    var config = holder.append('div'),
        mainPane,
        barPane,
        selectedPane;

    config.attr('class', 'configuration');
    mainPane = config.append('div').attr('class', 'main pane');
    mainPane.append('h3').text('Dataset');
    mainPane.append('select')
        .attr('class', 'data-name')
        .on('change', changeDataNameToSelected);
    mainPane.append('h3').text('Comparisons');
    mainPane.append('select')
        .attr('class', 'compare xc');
    mainPane.append('label').text('compared to');
    mainPane.append('select')
        .attr('class', 'compare yc');
    mainPane.append('div')
        .text('Add')
        .attr('class', 'button')
        .on('click', addCompareChart);

    barPane = config.append('div').attr('class', 'bar pane');
    barPane.append('h3').text('Bar Charts');
    barPane.append('ul')
        .attr('class', 'bar charts-list');

    selectedPane = config.append('div').attr('class', 'selected pane');
    selectedPane.append('h3').text('Selected Charts');
    selectedPane.append('ul')
        .attr('class', 'selected charts-list');
    selectedPane.append('div')
        .text('Clear')
        .attr('class', 'clear button')
        .on('click', clearSelectedCharts);

    selectedPane.append('div')
        .text('Update')
        .attr('class', 'update button')
        .on('click', function() { binfo.render(dataName, selected); });

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
    var definitionIds = [],
        id,
        firstDefinition;
    for (id in definitions) {
      if (definitions.hasOwnProperty(id)) {
        definitions[id].id = id;
        definitions[id].type = definitions[id].type || 'number';
        definitionIds.push(id);
      }
    }
    setDataSet(dataName, {definitions: definitions, definitionIds: definitionIds});
    firstDefinition = holder.selectAll('.data-name option').empty();
    holder.select('.data-name').append('option')
        .attr('value', dataName)
        .text(dataName);
    if (firstDefinition) {
      changeDataName(dataName);
    }
  };

  binfo.dataFromUntyped = function(dataName, data) {
    if (!(dataSets[dataName] && dataSets[dataName].definitions)) {
      dataSets[dataName] = {dataUntyped: data};
      return;
    }
    var definitions = dataSets[dataName].definitions,
        ids = dataSets[dataName].definitionIds;
    data.forEach(function(d) {
      ids.forEach(function(id) {
        var defn = definitions[id];
        if (defn.derived) {
          return;
        }
        if (typeof defn.type === 'function') {
          d[id] = defn.type(d[id]);
          return;
        }
        switch (defn.type) {
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

  function setDataSet(dataName, set) {
    var i,
        dataUntyped,
        dataSet = dataSets[dataName] = dataSets[dataName] || {};

    for (i in set) {
      if (set.hasOwnProperty(i)) {
        dataSet[i] = set[i];
      }
    }
    if (dataSet.dataUntyped) {
      dataUntyped = dataSet.dataUntyped;
      delete dataSet.dataUntyped;
      binfo.dataFromUntyped(dataName, dataUntyped);
      return;
    }
    if (dataSet.data && dataSet.definitions) {
      dataSet.complete = true;
      dataSet.charts = {};
      dataSet.chartIds = dataSet.definitionIds.slice();
      dataSet.definitionIds.forEach(function(id) {
        dataSet.charts[id] = chartsApi.barChart(dataSet.definitions[id],
                                                dataSet.data);
      });
      if (renderLater && renderLater[0] === dataName) {
        binfo.render.apply(null, renderLater);
        renderLater = null;
      }
    }
  }

  function changeDataNameToSelected() {
    var val = holder.select('.data-name').property('value');
    changeDataName(val, true);
  }

  function changeDataName(newDataName, clearSelected) {
    var ids = dataSets[newDataName].definitionIds,
        optionXc,
        optionYc,
        li;
    if (newDataName === dataName) {
      return;
    }
    if (clearSelected) {
      clearSelectedCharts();
    }
    dataName = newDataName;
    ensureChangeDataName(dataName);

    li = holder.select('.bar.charts-list').selectAll('li')
        .data(ids, function(d) { return d; });
    li.enter().append('li')
        .on('click', function(d) { addChart(d); })
      .append('div')
        .attr('class', 'label')
        .text(labelFromId);
    li.exit().remove();

    optionXc = holder.select('select.compare.xc').selectAll('option')
        .data(ids, function(d) { return d; });
    optionXc.enter().append('option')
        .attr('value', function(d) { return d; })
        .text(labelFromId);
    optionXc.exit().remove();

    optionYc = holder.select('select.compare.yc').selectAll('option')
        .data(['--nothing--'].concat(ids), function(d) { return d; });
    optionYc.enter().append('option')
        .attr('value', function(d) { return d; })
        .text(labelFromId);
    optionYc.exit().remove();
  }
  setupApi.changeDataName = changeDataName;

  // I'm encountering an odd bug where the select value won't update,
  // so this will force it to.
  function ensureChangeDataName(dataName) {
    var select = holder.select('.data-name');
    select.property('value', dataName);
    if (select.property('value') !== dataName) {
      setTimeout(function() { ensureChangeDataName(dataName); }, 300);
    }
  }

  function labelFromId(id) {
    if (id === '--nothing--') {
      return '-- Nothing -- (add bar chart)';
    }
    return dataSets[dataName].definitions[id].label;
  }

  function addCompareChart() {
    var xc = holder.select('select.compare.xc').property('value'),
        yc = holder.select('select.compare.yc').property('value');
    if (yc === '--nothing--') {
      addChart(xc);
    } else {
      addChart(xc + '*' + yc);
    }
  }

  function addChart(id) {
    if (selected.indexOf(id) < 0) {
      selected.push(id);
      setSelectedCharts(selected);
    }
  }

  function removeChart(id) {
    var index = selected.indexOf(id);
    selected.splice(index, 1);
    setSelectedCharts(selected);
  }

  function clearSelectedCharts() {
    setSelectedCharts([]);
  }

  function setSelectedCharts(_) {
    selected = _;
    var liEnter,
        li = holder.select('.selected.charts-list').selectAll('li')
        .data(selected, function(d) { return d; });

    liEnter = li.enter().append('li');
    liEnter.append('div')
        .attr('class', 'label')
        .html(function(id) {
          if (id.match(/\*/)) {
            var ids = id.split('*');
            return labelFromId(ids[0]) + ' <em>compared to</em> ' +
                   labelFromId(ids[1]);
          }
          return labelFromId(id);
        });
    liEnter.append('div')
        .attr('class', 'close')
        .html('&#10006;')
        .on('click', removeChart);

    li.order();

    li.exit().remove();
  }
  setupApi.setSelectedCharts = setSelectedCharts;

  return setupApi;
});


binfo._register('hashRetrieval', [], function() {

  "use strict";

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

});



binfo._register('rendering', ['setup', 'charts', 'logic'],
                function(setupApi, chartsApi, logicApi) {

  "use strict";

  var chartSelection,
      chartIds,
      cross,
      crossAll,
      charts,
      currentDataName,
      currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false,
      currentChartIds = [],
      currentShownChartIds = [],
      currentFilters = {},
      formatNumber = d3.format(',d');

  function arrayDiff(one, two) {
    return one.filter(function(id) {
      return two.indexOf(id) < 0;
    });
  }

  binfo.render = function(dataName, rawChartIds, filters) {

    var dataSet = setupApi.dataSet(dataName);

    if (!dataSet) {
      setupApi.renderLater([dataName, rawChartIds, filters]);
      return;
    }

    filters = filters || {};
    var data = dataSet.data,
        holder = setupApi.holder(),
        shownChartIds,
        chartData,
        added,
        removed;

    charts = dataSet.charts;

    chartIds = rawChartIds.map(function(raw) {
      return logicApi.idFromRaw(raw);
    });
    shownChartIds = chartIds.slice();
    chartData = shownChartIds.map(function(id, i) {
      var raw = rawChartIds[i];
      if (!charts[id]) {
        // Must be a compare chart
        charts[id] = chartsApi.compareChart({id: id, charts: charts});
      }
      if (charts[id].compare) {
        charts[id].given(raw.split('*')[2]);
        chartIds = charts[id].addChartIds(chartIds);
      }
      return {
        chart: charts[id],
        compare: charts[id].compare,
        orientFlip: charts[id].defaultOrientFlip
      };
    });

    removed = arrayDiff(currentChartIds, chartIds);
    added = arrayDiff(chartIds, currentChartIds);

    if (!cross || currentDataName !== dataName || removed.length) {
      cross = crossfilter(data);
      crossAll = cross.groupAll();
      added = chartIds;
    }
    currentChartIds = chartIds;
    currentShownChartIds = shownChartIds;
    currentDataName = dataName;
    currentFilters = filters;

    setupApi.changeDataName(dataName, false);
    setupApi.setSelectedCharts(shownChartIds);

    updateHash();

    added.forEach(function(id) {
      if (!charts[id].compare) charts[id].setCross(cross, crossAll);
    });
    added.forEach(function(id) {
      if (charts[id].compare) charts[id].setCross(cross, crossAll);
    });

    chartSelection = holder.select('.charts').selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();

    holder.select('.total')
        .text(formatNumber(cross.size()) + ' ' + dataName + ' selected.');

    // TODO needed anymore?
    renderAll();

    chartIds.forEach(function(id) {
      if (filters[id]) {
        charts[id].filter(filters[id]);
      } else {
        if (charts[id].filter) charts[id].filter(null);
      }
    });

    renderAll();

  };

  function updateHash() {
    var filter, filterData,
        chartString = 'charts=',
        filterString = 'filters=',
        filterArray = [];

    chartString += currentShownChartIds.map(function(id) {
      return charts[id].rawId();
    }).join(',');

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

  chartsApi.filter = function(id, range) {
    currentFilters[id] = range;
    charts[id].filter(range);
    renderAll();
    updateHash();
  };

  chartsApi.given = function(id, given) {
    charts[id].given(given);
    renderAll();
    updateHash();
  };


  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      var method = chartData.chart[name];
      if (method) {
        d3.select(this).each(method);
      }
    };
  }

  var renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('cleanUp');

  function renderAll() {
    chartIds.forEach(function(id) { charts[id].update(); });
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active').text(formatNumber(crossAll.value()));
  }

});

