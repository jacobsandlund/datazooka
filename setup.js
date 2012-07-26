
binfo._register('setup', ['charts', 'drag'], function(chartsApi, dragApi) {

  "use strict";

  var holder,
      renderLater,
      selected = [],
      selectedList,
      selectedRendered = [],
      dataSets = {},
      dataName,
      dataNameRendered,
      isUpdateActive,
      updateStyle = 'always-update',
      smartTimer = null,
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
        changeDatasetPane,
        addComparisonsPane,
        updateShownPane,
        optionsPane,
        options,
        barPane,
        selectedPane,
        selectedSubPane;

    config.attr('class', 'configuration');

    function activateAdd() {
      mainPane.select('.add.action.button').classed('active', true);
    }

    mainPane = config.append('div').attr('class', 'main pane');
    changeDatasetPane = mainPane.append('div')
        .attr('class', 'sub-pane');
    changeDatasetPane.append('h3').text('Change Dataset');
    changeDatasetPane.append('select')
        .attr('class', 'data-name')
        .on('change', changeDataNameToSelected);

    addComparisonsPane = mainPane.append('div')
        .attr('class', 'sub-pane add-comparisons');
    addComparisonsPane.append('h3').text('Add Comparisons');
    addComparisonsPane.append('select')
        .attr('class', 'compare xc')
        .on('change', activateAdd);
    addComparisonsPane.append('label').text('vs.');
    addComparisonsPane.append('select')
        .attr('class', 'compare yc')
        .on('change', activateAdd);
    addComparisonsPane.append('div')
        .text('Add')
        .attr('class', 'add action button')
        .on('click', addCompareChart);

    optionsPane = mainPane.append('div')
        .attr('class', 'options sub-pane');
    options = optionsPane.append('div')
        .style('display', 'none');
    function changeUpdateStyle() {
      updateStyle = this.id;
      var alwaysUpdate = updateStyle === 'always-update';
      updateShownPane.style('display', alwaysUpdate ? 'none' : 'block');
    }
    function addUpdateStyle(style, label) {
      var div = options.append('div');
      div.append('input')
          .attr('type', 'radio')
          .attr('name', 'update')
          .attr('id', style)
          .on('click', changeUpdateStyle);
      div.append('label')
          .attr('for', style)
          .text(label);
    }
    addUpdateStyle('always-update', 'Always update automatically');
    addUpdateStyle('smart-update', 'Smart update (on mouse still)');
    addUpdateStyle('manual-update', 'Manual update');
    optionsPane.select('#always-update').property('checked', true);
    optionsPane.append('div')
        .text('Options')
        .attr('class', 'options button')
        .on('click', function() {
          var disp = options.style('display');
          options.style('display', disp === 'block' ? 'none' : 'block');
          d3.select(this).classed('down', disp === 'none');
        });

    barPane = config.append('div').attr('class', 'bar pane');
    barPane.append('h3').html('Add Bar Charts<small>(click)<small>');
    barPane.append('ul')
        .attr('class', 'bar charts-list');

    selectedPane = config.append('div').attr('class', 'selected pane');
    selectedPane.append('h3').text('Move/Remove Selected');
    selectedSubPane = selectedPane.append('div')
        .attr('class', 'selected sub-pane');
    selectedList = selectedSubPane.append('ul')
        .attr('class', 'selected charts-list');
    selectedSubPane.append('div')
        .text('Remove All')
        .attr('class', 'clear button')
        .on('click', clearSelectedCharts);

    updateShownPane = selectedPane.append('div')
        .attr('class', 'sub-pane update-shown')
        .style('display', 'none');
    updateShownPane.append('div')
        .text('Update')
        .attr('class', 'update action button')
        .on('click', function() { renderSelected(); });
    updateShownPane.append('div')
        .text('Cancel')
        .attr('class', 'cancel button')
        .style('display', 'none')
        .on('click', function() {
          changeDataName(dataNameRendered, false);
          userSelectCharts(selectedRendered, true);
        });

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


    dragApi.setList(holder, selectedList, function() {
      var select = [],
          li = selectedList.selectAll('li');
      li.each(function(d) { select.push(d); });
      setSelectedCharts(select);
      if (!isUpdateActive) {
        renderSelected();
      }
    });

    holder.on('mousemove', function() {
      if (smartTimer !== null) {
        clearSmartTimer();
        startSmartTimer();
      }
    });
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
      addChart(xc + '-' + yc);
    }
  }

  function addChart(id) {
    if (selected.indexOf(id) < 0) {
      selected.push(id);
      userSelectCharts(selected);
    }
  }

  function removeChart(id) {
    var index = selected.indexOf(id);
    selected.splice(index, 1);
    userSelectCharts(selected);
  }

  function clearSelectedCharts() {
    userSelectCharts([]);
  }

  function userSelectCharts(selected, override) {
    var updated,
        smartUpdate = override || updateStyle === 'smart-update';
    clearSmartTimer();
    setSelectedCharts(selected);
    if (override || updateStyle !== 'manual-update') {
      updated = renderSelected(smartUpdate);
    }
    updateActive(!updated);
    if (smartUpdate && !updated) {
      startSmartTimer();
    }
  }

  function updateActive(active) {
    isUpdateActive = active;
    holder.select('.update.action.button').classed('active', active);
    holder.select('.cancel.button').style('display', active ? null : 'none');
  }

  function clearSmartTimer() {
    if (smartTimer !== null) {
      clearTimeout(smartTimer);
      smartTimer = null;
    }
  }

  function startSmartTimer() {
    smartTimer = setTimeout(function() {
      renderSelected();
    }, 700);
  }

  function setSelectedCharts(_) {
    selected = _;
    var item,
        active,
        li = selectedList.selectAll('li')
        .data(selected, function(d) { return d; });

    item = li.enter().append('li')
      .append('div')
        .attr('class', 'item');
    item.append('div')
        .attr('class', 'label')
        .html(function(id) {
          if (id.match(/-/)) {
            var ids = id.split('-');
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
  }

  function renderSelected(smartUpdate) {
    updateActive(false);
    return binfo.render(dataName, selected, null, smartUpdate);
  }

  setupApi.updateUponRender = function(dataNameRend, selectedRend) {
    selectedRendered = selectedRend.slice();
    dataNameRendered = dataNameRend;
    changeDataName(dataNameRend, false);
    setSelectedCharts(selectedRendered);
  };

  return setupApi;
});

