
binfo._register('setup', ['core'], function(setup, core) {

  "use strict";

  var definitions = {},
      data = {},
      untypedData = {};

  binfo.definitionsFromJSON = function(dataName, defns) {
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
        evil.push('defns["', id, '"].', part, ' = ', defn[part], ';');
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

    for (id in defns) {
      if (defns.hasOwnProperty(id)) {
        defn = defns[id];
        evalParts.forEach(makeEvil(defn, id));
        evalPartsIfFunc.forEach(maybeMakeEvil(defn, id));
      }
    }
    eval(evil.join(''));
    binfo.definitions(dataName, defns);
  };

  binfo.definitions = function(dataName, defns) {
    var id;
    for (id in defns) {
      if (defns.hasOwnProperty(id)) {
        defns[id].id = id;
        defns[id].type = defns[id].type || 'number';
      }
    }
    definitions[dataName] = defns;
    if (untypedData[dataName]) {
      binfo.dataFromUntyped(dataName, untypedData[dataName]);
    }
    checkLoaded(dataName);
  };

  binfo.dataFromUntyped = function(dataName, data) {
    if (!definitions[dataName]) {
      untypedData[dataName] = data;
      return;
    }
    var defns = definitions[dataName],
        id,
        defn;
    data.forEach(function(d) {
      for (id in defns) {
        if (!defns.hasOwnProperty(id)) {
          continue;
        }
        defn = defns[id];
        if (defn.derived) {
          continue;
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
      }
    });
    binfo.data(dataName, data);
  };

  binfo.data = function(dataName, _) {
    data[dataName] = _;
    checkLoaded(dataName);
  };

  function checkLoaded(name) {
    if (definitions[name] && data[name]) {
      core.dataSet(name, definitions[name], data[name]);
    }
  }

});


binfo._register('hashRetrieval', ['core'], function(_, core) {

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
    if (!dataName || !charts || !charts.length) {
      return;
    }
    core.renderFresh(dataName, charts, myFilters);
  }

  window.onhashchange = renderFromHash;

  renderFromHash();
});



binfo._register('hash', [], function(hash) {

  var currentHash,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false;

  hash.refresh = function(dataName, charts, chartIds) {
    var filters = {},
        id,
        filterData,
        chartString = 'charts=' + chartIds.join(','),
        filterString = 'filters=',
        filterArray = [];

    function filterEncode(d) {
      if (typeof d === 'object') {
        d = d.valueOf();
      }
      return encodeURIComponent(d);
    }
    chartIds.forEach(function(id) { charts[id].addToFilters(filters); });
    for (id in filters) {
      if (filters.hasOwnProperty(id) && filters[id]) {
        filterData = filters[id].map(filterEncode).join('*');
        filterArray.push(id + '*' + filterData);
      }
    }
    filterString += filterArray.join(',');
    var params = ['data=' + dataName, chartString, filterString].join('&');
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
});


binfo._register('rendering', ['core'], function(rendering, core) {

  "use strict";

  var holder,
      chartSelection,
      cross,
      crossAll,
      dataName,
      charts,
      chartIds,
      formatNumber = d3.format(',d');

  core.getHolder(function(_) { holder = _; });

  rendering.setCross = function(_, all, name) {
    cross = _;
    crossAll = all;
    dataName = name;  // TODO, possibly remove this.
  };

  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      d3.select(this).each(chartData.chart[name]);
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('resetUpdate');

  rendering.refresh = function(crossAll) {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(crossAll.value()));
  }

  rendering.render = function(charts, chartIds) {
    var chartsHolder = holder.select('.charts'),
        chartData;

    chartData = chartIds.map(function(id, i) {
      return {chart: charts[id]};
    });

    chartSelection = chartsHolder.selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();
  };

  rendering.renderTotal = function(total, dataName) {
    holder.select('.total')
        .text(formatNumber(total) + ' ' + dataName + ' selected.');
  };
});

