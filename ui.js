
binfo._register('ui', [], function(uiApi) {

  "use strict";

  var renderingApi = uiApi.dependency('rendering'),
      setupApi = uiApi.dependency('setup'),
      holder,
      getHolders = [],
      selected = [],
      selectedList,
      selectedRendered = [],
      dataName,
      dataNameRendered,
      isUpdateActive,
      updateStyle = 'always-update',
      smartTimer = null;

  uiApi.getHolder = function(getCallback) {
    if (holder) {
      if (getCallback) {
        getCallback(holder);
      }
      return holder;
    }
    getHolders.push(getCallback);
  };

  binfo.holder = function(_, width) {
    binfo.width = width;
    holder = d3.select(_);
    holder
        .attr('class', 'holder')
        .style('width', width);
    getHolders.forEach(function(h) { h(holder); });

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
    function toggleDock() {
      var dockButton = totals.select('.total-dock.button'),
          dock = dockButton.classed('down');
      dockButton.classed('down', !dock);
      totals.style('position', dock ? null : 'fixed');
      if (dock) {
        dockButton.text('Undock');
      } else {
        dockButton.text('Dock');
      }
    }
    totals.append('div')
        .attr('class', 'total-dock button')
        .on('click', toggleDock);
    toggleDock();


    holder.on('mousemove', function() {
      if (smartTimer !== null) {
        clearSmartTimer();
        startSmartTimer();
      }
    });
  };

  function renderSelected(smartUpdate) {
    updateActive(false);
    return renderingApi.render(selected, null, smartUpdate);
  }

  uiApi.renderedDataName = function(_) {
  };

  uiApi.renderOccurred = function() {
  };

  function changeDataNameToSelected() {
    var val = holder.select('.data-name').property('value');
    changeDataName(val, true);
  }

  function changeDataName(newDataName, clearSelected) {
    var ids = setupApi.dataSet(newDataName, true).definitionIds,
        optionXc,
        optionYc,
        li;
    if (newDataName === dataName) {
      return;
    }
    dataName = newDataName;
    ensureChangeDataName(dataName);
    if (clearSelected) {
      clearSelectedCharts();
    }

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
  uiApi.changeDataName = changeDataName;

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
    return setupApi.dataSet(dataName, true).definitions[id].label;
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

});
