
binfo._register('ui', ['core'], function(ui, core) {

  "use strict";

  var rendering = ui.dependency('rendering'),
      setup = ui.dependency('setup'),
      holder,
      panel,
      disableModeTimer,
      dataName,
      needsUpdate,
      chartMode,
      firstCompare;

  ui.setup = function(h, header, width) {
    holder = h;
    holder
        .attr('class', 'holder')
        .style('width', width);

    var config,
        totals,
        interactions,
        statistics,
        updatePanel,
        viewToggles,
        optionsPanel;

    holder.append('div')
        .attr('class', 'charts');

    panel = header.insert('div', ':first-child')
        .attr('class', 'control-panel');

    panel.append('div')
        .attr('class', 'tool title')
        .text('Binfo');

    config = panel.append('div')
        .attr('class', 'config pane');

    totals = config.append('div')
        .attr('class', 'totals');
    totals.append('span')
        .attr('class', 'active-data')
        .text('-');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total')
        .text('-');

    totals.append('select')
        .attr('class', 'data-name')
        .on('change', function() {
          changeDataName(this.value);
          core.changeDataName(this.value);
        });

    interactions = config.append('div')
        .attr('class', 'interactions');

    interactions.append('span').text('Add');

    interactions.append('div')
        .attr('class', 'bar button')
        .text('Bar')
        .on('click', function() { setChartMode('bar'); });

    interactions.append('span').text('or');

    interactions.append('div')
        .attr('class', 'compare button')
        .text('Compare')
        .on('click', function() { setChartMode('compare'); });

    interactions.append('span').text('charts.');

    interactions.append('div')
        .attr('class', 'remove-all button')
        .text('Remove All')
        .on('click', core.clearCharts);

    statistics = interactions.append('div')
        .attr('class', 'statistics')
        .style('display', 'none')
        .on('mouseover', function() {
          if (disableModeTimer) {
            clearTimeout(disableModeTimer);
          }
        })
        .on('mouseout', function() {
          var e = d3.event,
              tgt = e.target,
              related;
          // Taken from quirksmode
          related = e.relatedTarget;
          if (related) {
            while (related !== tgt && related.nodeName !== 'BODY') {
              related = related.parentNode;
            }
            if (related === tgt) return;
          }
          disableModeTimer = setTimeout(setChartMode, 550);
        });
    statistics.append('ul');

    updatePanel = statistics.append('div')
        .attr('class', 'update panel')
        .style('display', 'none');
    updatePanel.append('div')
        .attr('class', 'update action button')
        .text('Update')
        .on('click', function() { core.update('force'); });
    updatePanel.append('div')
        .attr('class', 'cancel button')
        .text('Cancel')
        .style('display', 'none')
        .on('click', core.cancel);

    viewToggles = panel.append('div')
        .attr('class', 'view-toggles pane');

    viewToggles.append('div')
        .text('Options')
        .attr('class', 'options button')
        .on('click', toggleOptionsPanel);

    optionsPanel = viewToggles.append('div')
        .attr('class', 'options-panel')
        .style('display', 'none');
    optionsPanel.append('div')
        .attr('class', 'title')
        .text('Options');
    optionsPanel.append('div')
        .attr('class', 'remove')
        .html('&#10006;')
        .on('click', toggleOptionsPanel);
    function changeUpdateMode() {
      var updateMode = this.id.slice(7);
      var always = updateMode === 'always';
      core.updateMode(updateMode);
      updatePanel.style('display', always ? 'none' : 'block');
      if (always) {
        core.update();
      }
    }
    function addUpdateStyle(style, label) {
      var div = optionsPanel.append('div');
      div.append('input')
          .attr('type', 'radio')
          .attr('name', 'update')
          .attr('id', style)
          .on('click', changeUpdateMode);
      div.append('label')
          .attr('for', style)
          .text(label);
    }
    addUpdateStyle('update-always', 'Always update automatically');
    addUpdateStyle('update-smart', 'Smart update (on mouse still)');
    addUpdateStyle('update-manual', 'Manual update');
    optionsPanel.select('#update-' + core.updateMode()).property('checked', true);
    optionsPanel.append('div')
        .attr('class', 'close-options button')
        .text('Close')
        .on('click', toggleOptionsPanel);

  };

  function toggleOptionsPanel() {
    var optionsPanel = panel.select('.options-panel'),
        disp = optionsPanel.style('display');
    optionsPanel.style('display', disp === 'block' ? 'none' : 'block');
    panel.select('.options.button').classed('down', disp === 'none');
  }

  function showStatistics(show) {
    show = show ? null : 'none';
    if (!needsUpdate) {
      panel.select('.statistics').style('display', show);
    }
    panel.select('.statistics ul').style('display', show);
  }

  function changeDataName(newDataName) {
    if (newDataName === dataName) {
      return;
    }
    var set = core.dataSet(newDataName),
        ids = set.definitionIds,
        defns = set.definitions,
        data,
        li;
    dataName = newDataName;
    panel.select('.data-name').property('value', dataName);
    data = ids.map(function(id) { return {id: id, label: defns[id].label}; });

    li = panel.select('.statistics ul').selectAll('li')
        .data(data, function(d) { return d.id; });
    li.enter().append('li')
        .on('click', clickChart)
        .text(function(d) { return d.label; });
    li.exit().remove();
  }

  function clickChart(d) {
    if (chartMode === 'compare') {
      if (firstCompare) {
        if (firstCompare !== d.id) {
          core.addChart(firstCompare + '-' + d.id);
        }
        firstCompareReset();
      } else {
        firstCompare = d.id;
        d3.select(this).classed('down', true);
      }
    } else {
      core.addChart(d.id);
    }
  }

  function firstCompareReset() {
    firstCompare = null;
    panel.selectAll('.statistics li.down').classed('down', false);
  }

  function setChartMode(mode) {
    if (chartMode === mode) {
      mode = null;
    }
    if (disableModeTimer) {
      clearTimeout(disableModeTimer);
    }
    chartMode = mode;
    panel.select('.compare.button').classed('down', mode === 'compare');
    panel.select('.bar.button').classed('down', mode === 'bar');
    if (mode) {
      showStatistics(true);
    } else {
      showStatistics(false);
      firstCompareReset();
    }
  }

  ui.addDataName = function(name) {
    panel.select('.data-name').append('option')
        .attr('value', name)
        .text(name);
  };

  ui.needsUpdate = function(needs) {
    needsUpdate = needs;
    if (needs) {
      panel.select('.statistics').style('display', 'block');
    }
    panel.select('.update.action.button').classed('active', needs);
    panel.select('.cancel.button').style('display', needs ? null : 'none');
  }

  ui.updating = function(updating) {
    holder.select('.charts').style('opacity', updating ? 0.3 : null);
    panel.style('opacity', updating ? 0.3 : null);
  };

  ui.updated = function(name) {
    changeDataName(name);
    ui.needsUpdate(false);
    ui.updating(false);
  };

});

