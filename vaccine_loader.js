
(function() {

  var appName = 'datazooka',       // Change this to your app name.
      sourceDir = 'src';   // Change this to... uh, your source directory.

  // Change libraryDir to the directory of your pre-built library dependencies.
  var libraryDir = 'lib';


  // The scripts that are currently loading. Don't touch this.
  var loading = {};

  function define(id, defn) {

    var globalVaccine =
    window.vaccine || (window.vaccine = {
      // The minimal code required to be vaccine compliant.

      // w = waiting: Functions to be called when a modules
      // gets defined. w[moduleId] = [array of functions];
      w: {},

      // m = modules: Modules that have been fully defined.
      // m[moduleId] = module.exports value
      m: {},

      // s = set: When a module becomes fully defined, set
      // the module.exports value here.
      // s(moduleId, module.exports)
      s: function(id, val) {
        this.m[id] = val;
        (this.w[id] || []).forEach(function(w) { w(); });
      }
    });
    // Set your library with vaccine.s('mylib', mylib);

    var parts = id.split('/');

    var module = {exports: {}};

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
      var mod = globalVaccine.m[reqId];
      if (!mod) {
        require.id = reqId;
        throw require;  // Throw require, to ensure correct error gets handled
      }

      return mod;
    }

    try {
      defn(require, module.exports, module);
      globalVaccine.s(id, module.exports);
      if (id.match(/\/index$/)) {
        globalVaccine.s(id.replace(/\/index$/,''), module.exports);
      }
    } catch (e) {
      if (e != require) throw e;

      var split = require.id.split('/'),
          root = split.shift(),
          src,
          script;
      if (root === appName) {
        src = sourceDir + '/' + split.join('/');
      } else {
        src = libraryDir + '/' + root;
      }
      loadScript('/' + src + '.js');
      (globalVaccine.w[require.id] || (globalVaccine.w[require.id] = []))
          .push(function() { define(id, defn); });
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


  var initialScripts = [],
      loaded = false;

  // The first define, which will trigger the loading of your app,
  // and any other initial scripts.
  define('initial_scripts', function(require) {

    // Pull in your app and all it's dependencies.
    require(appName);

    loaded = true;

    // Load initial scripts after the main app is loaded.
    initialScripts.forEach(function(src) { loadScript(src); });
  });

  window.vaccine_load = function(src) {
    if (loaded) {
      loadScript(src);
    } else {
      initialScripts.push(src);
    }
  };

}());

