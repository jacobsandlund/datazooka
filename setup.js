
binfo._register('setup', ['charts', 'drag'], function(chartsApi, dragApi) {

  "use strict";

  var holder,
      renderLater,
      selected = [],
      previousSel,
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

    function activateAdd() {
      mainPane.select('.add.action.button').classed('active', true);
    }

    mainPane = config.append('div').attr('class', 'main pane');
    mainPane.append('h3').text('Dataset');
    mainPane.append('select')
        .attr('class', 'data-name')
        .on('change', changeDataNameToSelected);
    mainPane.append('h3').text('Comparisons');
    mainPane.append('select')
        .attr('class', 'compare xc')
        .on('change', activateAdd);
    mainPane.append('label').text('vs.');
    mainPane.append('select')
        .attr('class', 'compare yc')
        .on('change', activateAdd);
    mainPane.append('div')
        .text('Add')
        .attr('class', 'add action button')
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

    dragApi.setList(holder, holder.select('.selected.charts-list'), function() {
      var select = [],
          li = holder.select('.selected.charts-list').selectAll('li');
      li.each(function(d) { select.push(d); });
      setSelectedCharts(select);
    });

    selectedPane.append('div')
        .text('Update')
        .attr('class', 'update action button')
        .on('click', function() { binfo.render(dataName, selected); });

    holder.append('div')
        .attr('class', 'charts');

    var totals = holder.append('aside')
        .attr('class', 'totals');
    totals.append('span')
        .attr('class', 'active-data')
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
        .attr('class', 'item')
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
    holder.select('.add.action.button').classed('active', false);
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
    var item,
        active,
        li = holder.select('.selected.charts-list').selectAll('li')
        .data(selected, function(d) { return d; });

    item = li.enter().append('li')
      .append('div')
        .attr('class', 'item');
    item.append('div')
        .attr('class', 'label')
        .html(function(id) {
          if (id.match(/\*/)) {
            var ids = id.split('*');
            return labelFromId(ids[0]) + ' <em>vs.</em> ' +
                   labelFromId(ids[1]);
          }
          return labelFromId(id);
        });
    item.append('div')
        .attr('class', 'close')
        .html('&#10006;')
        .on('click', removeChart);

    li.order();

    li.exit().remove();

    active = previousSel && selected.join(',') !== previousSel.join(',');
    holder.select('.update.action.button').classed('active', active);
    previousSel = selected.slice();
  }
  setupApi.setSelectedCharts = setSelectedCharts;

  return setupApi;
});

