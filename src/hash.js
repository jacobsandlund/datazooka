
define('datazooka/hash', function(require, exports) {

  var arrange = require('./arrange'),
      chartIds,
      charts,
      dataName,
      hashParams = [0,0,0],
      isEnable = true,
      hashUpdatedRecently = false,
      hashNeedsUpdated = false;

  exports.disable = function() {
    isEnable = false;
  };

  exports.refresh = function(name, ids, c) {
    dataName = name;
    chartIds = ids;
    charts = c;
    isEnable = true;
    exports.refreshParams();
  };

  exports.refreshParams = function() {
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

});

