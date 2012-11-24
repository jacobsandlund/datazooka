function define(id, factory) {
  (vaccineFactories = vaccineFactories || {}
  )[id] = factory;
}


function require(id) {

  if (!vaccineModules[id] && !vaccineWindow[id]) {
    vaccineModules[id] = vaccineFactories[id](
        function(reqId) {
          return require(reqId.replace('.', 'datazooka'));
        });
  }
  return vaccineModules[id] || vaccineWindow[id];
}


var vaccineFactories,
    vaccineModules = {},
    vaccineWindow = window;

  vaccineWindow.datazooka = require('index');
