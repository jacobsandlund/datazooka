
define('binfo/stylesheet', function(require) {

  var stylesheet = {},
      config = require('./config');

  stylesheet.setup = function(holder) {
    var css = '',
        i,
        lvl,
        levels = config.compareLevels,
        level = d3.scale.linear(),
        pts = [],
        domain,
        blue = 222,
        blueIndigo = 200,
        indigo = 180,
        indigoGreen = 158,
        green = 120,
        greenYellow = 80,
        yellow = 60,
        yellowOrange = 45,
        orange = 30,
        orangeRed = 15,
        red = 0,
        hue = d3.scale.linear(),
        saturation = d3.scale.linear(),
        fadeSaturation = d3.scale.linear(),
        brightness = d3.scale.linear(),
        fadeScale = d3.scale.linear(),
        fullScale = d3.scale.identity();
    level
        .domain([0, levels - 1])
        .range([0, 1]);

    pts = [
      {d: 0,      h: blue,        b: 35},
      {d: 0.17,   h: blueIndigo,  b: 40},
      {d: 0.22,   h: indigo,      b: 35},
      {d: 0.3,    h: indigoGreen, b: 38},
      {d: 0.41,   h: green,       b: 42},
      {d: 0.54,   h: greenYellow, b: 60},
      {d: 0.65,   h: yellow,      b: 50},
      {d: 0.725,  h: yellowOrange,b: 50},
      {d: 0.83,   h: orange,      b: 50},
      {d: 0.95,   h: orangeRed,   b: 50},
      {d: 1,      h: red,         b: 60}
    ];
    domain = pts.map(function(d) { return d.d; });
    hue.range(pts.map(function(d) { return d.h; }));
    brightness.range(pts.map(function(d) { return d.b;}));
    saturation
        .domain([0, 1])
        .range([100, 100]);
    fadeSaturation
        .domain([0, 1])
        .range([40, 40]);
    hue.domain(domain);
    brightness.domain(domain);
    fadeScale
        .domain([35, 60])
        .range([78, 92]);

    function addCss(prefix, sat, brightScale) {
      for (i = 0; i < levels; i++) {
        lvl = level(i);
        css += '.' + prefix + '-' + i + '{fill:hsl(';
        css += hue(lvl) + ',';
        css += sat(lvl) + '%,';
        css += brightScale(brightness(lvl)) + '%';
        css += ');}';
      }
    };

    addCss('level', saturation, fullScale);
    addCss('level-fade', fadeSaturation, fadeScale);

    holder.append('style').html(css);
  };

  return stylesheet;
});


define('binfo/hash_retrieval', function(require) {

  var core = require('./core');

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
    var hashParams = getHashParams();
    var dataName = hashParams.data,
        charts = hashParams.charts && hashParams.charts.split(','),
        params = {};

    params.given = getParams(hashParams.given);
    params.filter = getParams(hashParams.filter);
    params.filterLevels = getParams(hashParams.filterLevels);
    if (!dataName || !charts || !charts.length) {
      return;
    }
    core.renderFresh(dataName, charts, params);
  }

  function getParams(hashParam) {
    var paramArray = hashParam && hashParam.split(','),
        param = {};
    if (paramArray) {
      paramArray.forEach(function(p) {
        var map = p.split('*'),
            data = map.slice(1);
        if (data.length === 1) {
          data = data[0];
        }
        param[map[0]] = data;
      });
    }
    return param;
  }

  window.onhashchange = renderFromHash;

  renderFromHash();

  return true;
});



define('binfo/hash', function(require) {

  var arrange = require('./arrange'),
      chartIds,
      charts,
      dataName,
      hashParams = [0,0,0],
      isEnable = true,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false,
      hash = {};

  hash.disable = function() {
    isEnable = false;
  };

  hash.refresh = function(name, ids, c) {
    dataName = name;
    chartIds = ids;
    charts = c;
    isEnable = true;
    hash.refreshParams();
  };

  hash.refreshParams = function() {
    if (!isEnable) {
      return;
    }
    var params = {filter: {}, given: {}, filterLevels: {}};
    chartIds.forEach(function(id) { charts[id].addToParams(params); });
    hashParams = [
      'data=' + dataName,
      null,   // Reserved for chart ids
      paramString(params, 'given'),
      paramString(params, 'filterLevels'),
      paramString(params, 'filter')
    ];
    hashNeedsUpdated = true;
    if (!hashUpdatedRecently) {
      updateWindowHash();
    }
  };

  function paramString(params, string) {
    var param = params[string],
        data,
        id,
        paramArray = [];
    function filterEncode(d) {
      if (typeof d === 'object') {
        d = d.valueOf();
      }
      return encodeURIComponent(d);
    }
    for (id in param) {
      if (param.hasOwnProperty(id) && param[id]) {
        data = param[id];
        if (Array.isArray(data)) {
          data = data.map(filterEncode).join('*');
        }
        paramArray.push(id + '*' + data);
      }
    }
    return string + '=' + paramArray.join(',');
  }

  function updateWindowHash() {
    hashUpdatedRecently = false;
    var ordered = arrange.orderedChartIds(chartIds, charts);
    if (ordered) {
      hashNeedsUpdated = true;
      chartIds = ordered;
    } else {
      ordered = chartIds;
    }
    if (hashNeedsUpdated) {
      hashParams[1] = 'charts=' + ordered.join(',');
      var currentHash = '#' + hashParams.join('&');
      window.history.replaceState({}, '', currentHash);
      hashUpdatedRecently = true;
      hashNeedsUpdated = false;
    }
  }
  setInterval(updateWindowHash, 600);

  return hash;
});


define('binfo/rendering', function() {

  var chartSelection,
      formatNumber = d3.format(',d'),
      formatPercent = d3.format('.3p'),
      rendering = {};

  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      d3.select(this).each(chartData.chart[name]);
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('resetUpdate');

  rendering.refresh = function(active, total) {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(active));
    d3.select('.total').text(formatNumber(total));
    d3.select('.percent-active').text(' (' + formatPercent(active / total) + ')');
  }

  rendering.render = function(chartIds, charts) {
    var chartData;

    chartData = chartIds.map(function(id, i) {
      return {chart: charts[id]};
    });

    chartSelection = d3.select('.holder').selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();
  };

  return rendering;

});

