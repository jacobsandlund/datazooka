
define('datazooka/hash_retrieval', function(require) {

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

});

