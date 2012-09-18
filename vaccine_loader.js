
(function() {

  var appName = 'binfo';   // Change this to your app name.

  // Change appMain to the location of your app's main/index file,
  // but without .js at the end.
  var appMain = 'src/index';

  // Change libraryDir to the directory of your pre-built library dependencies.
  var libraryDir = 'lib';


  // Figure out your app's main module based on the path to it (appMain).
  // Also determine the source directory.
  var appMainSplit = appMain.split('/'),
      appMainModule = appMainSplit.pop(),
      sourceDir = appMainSplit.join('/') || '.';

  // The scripts that are currently loading. Don't touch this.
  var loading = {};

  // The first define, which will trigger the loading of your app.
  define('initial_scripts', function(require) {
    require(appName);   // Pull in your app and all it's dependencies.

    loadScript('/test/test.js');
    // If you need to load any other scripts, do so here.
    //
    // Example:
    //    require('test_my_app');
    //
    // Or, if you have a script that isn't in 'sourceDir' or
    // 'libraryDir', you can load it with 'loadScript'.
    //
    // Example:
    //    loadScript('test_my_app');
    //
  });


  function define(id, defn) {

    if (!window.vaccine) {
      // The minimal code required to be vaccine compliant.
      (function() {
        var waiting = {}, modules = {};
        window.vaccine = {
          on: function(id, callback) {
            (waiting[id] = waiting[id] || []).push(callback);
          },
          get: function(id) {
            return modules[id];
          },
          set: function(id, val) {
            modules[id] = val;
            (waiting[id] || []).forEach(function(w) { w(); });
          }
        };
      }());
    }
    // Set your library with vaccine.set('mylib', mylib);

    var parts = id.split('/'),
        globalVaccine = window.vaccine,
        module = {exports: {}};

    function require(reqId) {
      var matching = /(\.?\.\/?)*/.exec(reqId)[0],
          // Some code golf to get the number of "directories" back we want to go
          back = Math.floor(matching.replace(/\//g, '').length / 1.9 + 0.99),
          base;
      if (back) {
        base = parts.slice(0, parts.length - back).join('/');
        if (base) base += '/';
        reqId = base + reqId.slice(matching.length);
      }
      reqId = reqId.replace(/\/$/, '');
      var mod = globalVaccine.get(reqId);
      if (!mod) {
        require.id = reqId;
        throw require;  // Throw require, to ensure correct error gets handled
      }
      return mod;
    }

    try {
      defn(require, module.exports, module);
      globalVaccine.set(id, module.exports);
    } catch (e) {
      if (e != require) throw e;

      var split = require.id.split('/'),
          root = split.shift(),
          src,
          script;
      if (root === appName) {
        if (!split.length) {
          split.push(appMainModule);
        }
        src = sourceDir + '/' + split.join('/');
      } else {
        src = libraryDir + '/' + root;
      }
      loadScript('/' + src + '.js');
      globalVaccine.on(require.id, function() { define(id, defn); });
    }
  }


  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = src;
      script = document.createElement('script');
      script.src = src;
      document.head.appendChild(script);
    }
  }

  window.define = define;

}());

