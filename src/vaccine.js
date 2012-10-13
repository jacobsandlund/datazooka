function define(id, defn) {



  var module = {exports: {}};

  function require(reqId) {
    return globalVaccine.m[reqId.replace('.', 'datazooka')];
  }


    defn(require, module.exports, module);
    globalVaccine.s(id, module.exports);
}

var
    vaccineDependencies = ["d3","crossfilter"],
    vaccineRemainingDeps = vaccineDependencies.length,
    vaccineRunDefines = function() { --vaccineRemainingDeps || vaccineDefines(); },
    globalVaccine =
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
vaccineDependencies.forEach(function(d) {
  if (globalVaccine.m[d]) --vaccineRemainingDeps;
  else  (globalVaccine.w[d] ||
          (globalVaccine.w[d] = [])
        ).push(vaccineRunDefines);
});
if (!vaccineRemainingDeps) vaccineDefines();
