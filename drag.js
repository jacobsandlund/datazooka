
binfo._register('drag', [], function(dragApi) {

  var holder,
      drag,
      dragNode,
      ghost,
      ghostNode,
      topOffset,
      leftOffset,
      list,
      listNode;

  dragApi.setList = function(setHolder, setList, onDragEnd) {
    holder = setHolder;
    list = setList;
    listNode = list.node();
    ghostNode = document.createElement('li');
    ghost = d3.select(ghostNode).attr('class', 'ghost');
    holder.on('mouseup.drag', function() {
      if (drag) {
        endDrag();
        onDragEnd();
      }
    });
    holder.on('mousemove.drag', function() {
      if (drag) {
        updateDrag();
      }
    });
    list.on('mousedown.drag', function() {
      var target = d3.event.target,
          parent;
      if (d3.select(target).classed('close')) {
        return;
      }
      parent = target;
      if (target === listNode) {
        return;
      }
      while (parent !== listNode) {
        target = parent;
        parent = target.parentNode
      }

      dragNode = target;
      var mouseDrag = d3.mouse(dragNode);
      leftOffset = mouseDrag[0];
      topOffset = mouseDrag[1];
      ghost.style('height', dragNode.offsetHeight + 'px');
      listNode.insertBefore(ghostNode, dragNode);
      drag = d3.select(dragNode)
          .attr('class', 'drag');
      updateDrag();
    });
  };

  function updateDrag() {
    var mouse = d3.mouse(listNode),
        x = mouse[0],
        y = mouse[1],
        insertBefore;
    drag.style('left', (x - leftOffset) + 'px');
    drag.style('top', (y - topOffset) + 'px');
    y -= parseInt(list.style('padding-top'));
    Array.prototype.slice.call(listNode.childNodes).forEach(function(li) {
      var h = li.offsetHeight;
      if (li.className === 'drag') {
        return;
      }
      if (y < h / 2) {
        insertBefore = li;
        y = 1e10;
      }
      y -= h;
    });
    if (!insertBefore) {
      listNode.appendChild(ghostNode);
      return;
    }
    if (insertBefore !== ghostNode) {
      ghost.remove();
      listNode.insertBefore(ghostNode, insertBefore);
    }
  }

  function endDrag() {
    drag.classed('drag', false);
    drag.remove();
    listNode.insertBefore(dragNode, ghostNode);
    ghost.remove();
    drag = null;
  }
});

