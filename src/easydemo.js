define('easydemo', function(require, exports) {
(function (root, factory) {
    if (typeof exports === 'object') {
        // CommonJS
        factory(exports);
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports'], factory);
    } else {
        var _exports = {};
        factory(_exports);
        root.easydemo = _exports;
    }
}(this, function (easydemo) {

  var createDiv = function() { return document.createElement('div'); };

  var createControl = function(spriteType, className) {
    var sprite = createDiv();
    sprite.className = 'sprite ' + spriteType;
    var control = createDiv();
    control.appendChild(sprite);
    control.className = className ? 'control ' + className : 'control';
    return control;
  };

  var createResize = function(type) {
    var resize = createDiv();
    resize.className = 'resize ' + type;
    return resize;
  };

  var demoBox = createDiv(),
      infoBox = createDiv(),
      infoBoxContainer = createDiv(),
      header = createDiv(),
      controls = createDiv(),
      title = document.createElement('span'),
      previousArrow = createControl('left-arrow', 'previous'),
      nextArrow = createControl('right-arrow'),
      openCloseArrow = createControl('down-arrow'),
      closeCross = createControl('cross', 'close'),
      leftResize = createResize('left'),
      rightResize = createResize('right'),
      bottomResize = createResize('bottom'),
      bottomLeftResize = createResize('bottom-left'),
      bottomRightResize = createResize('bottom-right'),
      pMargin = null,
      x = null,
      y = null,
      height = null,
      width = null,
      minHeight = 40,
      minWidth = null,
      activeState = {p: {}},
      currentState = {p: {}},
      infoEnds = [createDiv(), createDiv()],
      justFocused,
      changingStates,
      states,
      sameStateTimer,
      scrollEndTimer;

  easydemo.delay = 0;
  easydemo.sameDelay = 3000;
  easydemo.under = document.body;
  easydemo.finished = true;
  easydemo.activeSignalDelay = 800;

  header.className = 'header';
  header.appendChild(openCloseArrow);
  title.className = 'title';
  header.appendChild(title);
  controls.className = 'controls';
  controls.appendChild(previousArrow);
  controls.appendChild(nextArrow);
  controls.appendChild(closeCross);
  header.appendChild(controls);

  infoBoxContainer.className = 'info-container';
  infoBox.className = 'info';
  infoBoxContainer.appendChild(leftResize);
  infoBoxContainer.appendChild(rightResize);
  infoBoxContainer.appendChild(bottomResize);
  infoBoxContainer.appendChild(bottomLeftResize);
  infoBoxContainer.appendChild(bottomRightResize);
  infoBoxContainer.appendChild(infoBox);

  demoBox.id = 'easydemo';
  demoBox.appendChild(header);
  demoBox.appendChild(infoBoxContainer);

  easydemo.start = function(t, s) {
    title.innerHTML = t;
    states = s;
    infoBox.innerHTML = '';
    infoBox.appendChild(infoEnds[0]);

    states.forEach(function(s, i) {
      var p = document.createElement('p');
      p.className = 'state';
      p.onclick = partial(setScroll, s);
      s.p = p;
      s.index = i;
      p.innerHTML = s.text;
      s.signals = (s.signals || []).map(function(s) { return {info: s}; });
      var signalButtons = p.getElementsByTagName('signal');
      signalButtons = Array.prototype.slice.call(signalButtons);
      signalButtons.forEach(function(button, i) {
        var active = activateSignalFor(s.signals[i % s.signals.length]);
        button.onclick = button.onmouseover = active;
      });
      infoBox.appendChild(p);
    });

    infoBox.appendChild(infoEnds[1]);
    currentState = states[0];
    changeState();
    show();
  };

  var partial = function(func) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(
          Array.prototype.slice.call(arguments)));
    };
  };

  var activateSignalFor = function(signal) {
    var active;

    return function() {
      if (active) return;
      var changeActive = function(addOrRemove) {
        if (!signal.signalNodes) return;
        signal.signalNodes.forEach(function(node) {
          node.classList[addOrRemove]('active');
        });
      };
      changeActive('add');
      active = true;
      setTimeout(function() {
        changeActive('remove');
        active = false;
      }, easydemo.activeSignalDelay);
    };
  };

  var setState = function(state) {
    var delay = get(state, 'delay');
    if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
    if (!changingStates && delay) {
      scrollEndTimer = window.setTimeout(changeState, delay);
    }

    if (state === currentState) return;

    currentState.p.className = 'state';
    if (delay) state.p.className = 'state activating';
    activeState.p.className = 'state active';
    if (sameStateTimer) window.clearTimeout(sameStateTimer);
    currentState = state;
    if (!changingStates) {
      if (delay) {
        sameStateTimer = window.setTimeout(changeState, get(state, 'sameDelay'));
      } else {
        changeState();
      }
    }
  };

  var changeState = function() {
    if (currentState === activeState) return;

    var active = activeState;
    activeState = currentState;
    changingStates = true;
    active.p.className = 'state';
    currentState.p.className = 'state active';
    removeSignals(active);

    if (active.exit) {
      active.exit(exitFinished);
    } else {
      exitFinished();
    }
  };

  var exitFinished = function() {
    var nowSignals = (currentState.signals || []).filter(function(s) {
      return !get(s.info, 'finished');
    });
    nowSignals.forEach(setSignal);

    if (currentState.enter) {
      currentState.enter(enterFinished);
    } else {
      enterFinished();
    }
  };

  var enterFinished = function() {
    var finishedSignals = (currentState.signals || []).filter(function(s) {
      return get(s.info, 'finished');
    });
    finishedSignals.forEach(setSignal);
    changingStates = false;
    setState(currentState);
  };

  var removeSignals = function(state) {
    (state.signals || []).forEach(function(s) {
      s.signalNodes.forEach(function(node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      s.signalNodes = null;
    });
  };

  var setSignal = function(signal) {
    var under = get(signal.info, 'under'),
        xDim = typeof signal.info.left === 'undefined' ? 'right' : 'left',
        yDim = typeof signal.info.top === 'undefined' ? 'bottom' : 'top',
        underNodes = document.querySelectorAll(under);

    signal.signalNodes = [];

    underNodes = Array.prototype.slice.call(underNodes);
    underNodes.forEach(function(underNode) {
      var sigNode = createDiv(),
          div = createDiv(),
          x = signal.info[xDim],
          y = signal.info[yDim],
          underPosition = window.getComputedStyle(underNode).position;
      if (underPosition === 'static') underNode.style.position = 'relative';
      sigNode.className = 'easydemo-signal';
      if (+x === x) x = x + 'px';
      if (+y === y) y = y + 'px';
      sigNode.style[xDim] = x;
      sigNode.style[yDim] = y;
      sigNode.appendChild(div);
      underNode.appendChild(sigNode);
      signal.signalNodes.push(sigNode);
    });
  };

  var setScroll = function(state) {
    setState(state);
    var pos = height / 2,
        pHeight = state.p.offsetHeight,
        infoHeight = infoBox.clientHeight,
        scrollTop,
        i;
    for (i = 0; i < states.length; ++i) {
      if (states[i] === state) break;
      pos += states[i].p.offsetHeight + pMargin;
    }
    if (pHeight < infoHeight) {
      scrollTop = pos - (infoHeight - pHeight) / 2;
    } else {
      scrollTop = pos;
    }
    infoBox.scrollTop = scrollTop;
  };

  var onscroll = function() {
    if (infoBox.style.display === 'none') return;
    var pos = infoBox.scrollTop + infoBox.clientHeight / 2,
        i;
    pos -= height / 2;
    for (i = 0; i < states.length; ++i) {
      pos -= states[i].p.offsetHeight + pMargin;
      if (pos < 0) {
        setState(states[i]);
        return;
      }
    }
    setState(states[states.length - 1]);
  };

  var show = function() {
    if (demoBox.parentNode) return;
    document.body.appendChild(demoBox);
    if (x === null) x = window.innerWidth / 2 - demoBox.offsetWidth / 2;
    if (y === null) y = window.innerHeight / 2 - demoBox.offsetHeight / 2;
    if (height === null) height = infoBox.clientHeight;
    if (width === null) width = infoBox.clientWidth;
    toggleInfoBox();
    if (minWidth === null) minWidth = demoBox.offsetWidth;
    toggleInfoBox();
    if (pMargin === null) {
      var p = infoBox.getElementsByClassName('state')[0],
          pStyle = window.getComputedStyle(p);
      pMargin = +pStyle.marginBottom.replace(/px$/, '');
    }
    updatePositions();
    setScroll(currentState);
  };
  easydemo.show = show;

  var close = function() {
    if (!demoBox.parentNode) return;
    document.body.removeChild(demoBox);
  };
  easydemo.close = close;

  var toggleInfoBox = function() {
    var spriteClass = openCloseArrow.childNodes[0].classList,
        display = infoBox.style.display === 'none' ? 'block' : 'none';
    spriteClass.toggle('down-arrow');
    spriteClass.toggle('right-arrow');
    infoBox.style.display = display;
    infoBoxContainer.style.display = display;
  };

  var moveStateDelta = function(delta) {
    var i = currentState.index + delta;
    if (i < 0) i = 0;
    if (i >= states.length) i = states.length - 1;
    if (infoBox.style.display === 'none') toggleInfoBox();
    setScroll(states[i]);
  };

  var updatePositions = function() {
    var heightPx = Math.round(height) + 'px',
        widthPx = Math.round(width) + 'px';
    demoBox.style.top = Math.round(y) + 'px';
    demoBox.style.left = Math.round(x) + 'px';
    infoBox.style.width = widthPx;
    infoBox.style.height = heightPx;

    infoEnds.forEach(function(end) {
      end.style.height = Math.round(height / 2) + 'px';
    });
    leftResize.style.height = heightPx;
    rightResize.style.height = heightPx;
    bottomResize.style.width = widthPx;
  };

  var get = function(state, property) {
    if (typeof state[property] === 'undefined') return easydemo[property];
    return state[property];
  };


  var updateBoxBy = function(by) {
    by.x = by.x || 0;
    by.y = by.y || 0;
    by.width = by.width || 0;
    by.height = by.height || 0;

    return function(e) {
      var downCoords = mouseCoords(e),
          downX = x,
          downY = y
          downWidth = width,
          downHeight = height;

      var setUserSelect = function(select) {
        ['-webkit-user-select', '-webkit-touch-callout', '-moz-user-select',
            '-ms-user-select', 'user-select'].forEach(function(style) {
          document.body.style[style] = select;
        });
      };
      setUserSelect('none');

      var mousemove = function(e) {
        var coords = mouseCoords(e),
            deltaX = coords[0] - downCoords[0],
            deltaY = coords[1] - downCoords[1];
        x = downX + by.x * deltaX;
        y = downY + by.y * deltaY;
        width = downWidth + by.width * deltaX;
        height = downHeight + by.height * deltaY;
        if (width < minWidth) {
          x -= by.x * (minWidth - width);
          width = minWidth;
        }
        if (height < minHeight) height = minHeight;
        updatePositions();
      };

      var mouseup = function(e) {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
        setUserSelect(null);
        onscroll();
      };

      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
    };
  };

  var mouseCoords = function(e) {
    var posx = 0;
    var posy = 0;
    if (!e) var e = window.event;
    if (e.pageX || e.pageY) {
      posx = e.pageX;
      posy = e.pageY;
    } else if (e.clientX || e.clientY) {
      posx = e.clientX + document.body.scrollLeft +
             document.documentElement.scrollLeft;
      posy = e.clientY + document.body.scrollTop +
             document.documentElement.scrollTop;
    }
    return [posx, posy];
  };

  var unfocus = function() {
    if (justFocused) {
      justFocused = false;
    } else {
      demoBox.classList.add('unfocused');
    }
  };

  header.onmousedown = updateBoxBy({x: 1, y: 1});
  leftResize.onmousedown = updateBoxBy({x: 1, width: -1});
  rightResize.onmousedown = updateBoxBy({width: 1});
  bottomResize.onmousedown = updateBoxBy({height: 1});
  bottomLeftResize.onmousedown = updateBoxBy({x: 1, height: 1, width: -1});
  bottomRightResize.onmousedown = updateBoxBy({height: 1, width: 1});

  infoBox.onscroll = onscroll;

  openCloseArrow.onclick = toggleInfoBox;
  previousArrow.onclick = function() { moveStateDelta(-1); };
  nextArrow.onclick = function() { moveStateDelta(+1); };
  demoBox.onmousedown = function() {
    demoBox.classList.remove('unfocused');
    justFocused = true;
  };
  document.addEventListener('mousedown', unfocus);

  document.addEventListener('keydown', function(e) {
    if (e.keyCode === 9) unfocus();     // Tab
    if (!demoBox.classList.contains('unfocused')) {
      if (e.keyCode === 39) moveStateDelta(+1);   // Right arrow
      if (e.keyCode === 37) moveStateDelta(-1);   // Left arrow
    }
  });
  closeCross.onclick = close;

  window.easydemo = easydemo;

}));
});
