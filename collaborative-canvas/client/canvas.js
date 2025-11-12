(function(){
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  let tool = 'brush';
  let color = document.getElementById('color').value;
  let width = parseInt(document.getElementById('width').value, 10);

  const state = {
    drawing: false,
    currentPath: [],
    tempId: null,
    liveStrokes: new Map(), // tempId -> { points:[], color,width,mode, userId }
    remoteCursors: {}, // userId -> {x,y,el}
    ops: [] // full op log mirrored from server for redraws
  };

  function resize(){
    const { width: w, height: h } = canvas.getBoundingClientRect();
    const prev = { w: canvas.width, h: canvas.height, ops: state.ops.slice() };
    canvas.width = Math.floor(w);
    canvas.height = Math.floor(h);
    redraw(prev.ops);
  }

  function redraw(ops){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const op of ops){
      drawOp(op);
    }
  }

  function drawOp(op){
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = op.width;
    if(op.mode === 'eraser'){
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    }else{
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = op.color;
    }
    ctx.beginPath();
    for(let i=0;i<op.points.length;i++){
      const p = op.points[i];
      if(i===0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLiveStroke(live){
    if(!live || live.points.length < 2) return;
    const op = { points: live.points, color: live.color, width: live.width, mode: live.mode };
    drawOp(op);
  }

  function screenToCanvas(x,y){
    const rect = canvas.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  }

  // UI bindings
  document.getElementById('tool').addEventListener('change', e => tool = e.target.value);
  document.getElementById('color').addEventListener('change', e => color = e.target.value);
  document.getElementById('width').addEventListener('input', e => width = parseInt(e.target.value,10));

  document.getElementById('undoBtn').addEventListener('click', () => WS.emit('op:undo', {}));
  document.getElementById('redoBtn').addEventListener('click', () => WS.emit('op:redo', {}));
  document.getElementById('clearBtn').addEventListener('click', () => { ctx.clearRect(0,0,canvas.width,canvas.height); redraw(state.ops); });

  // Drawing handlers
  function startDraw(x,y){
    state.drawing = true;
    state.currentPath = [screenToCanvas(x,y)];
    state.tempId = crypto.randomUUID();
    WS.emit('stroke:start', { tempId: state.tempId, color, width, mode: tool });
  }
  function moveDraw(x,y){
    if(!state.drawing) return;
    const p = screenToCanvas(x,y);
    state.currentPath.push(p);
    WS.emit('stroke:point', { tempId: state.tempId, x: p.x, y: p.y });
    // Local prediction
    drawOp({ points: state.currentPath.slice(-2), color, width, mode: tool });
  }
  function endDraw(){
    if(!state.drawing) return;
    state.drawing = false;
    WS.emit('stroke:end', { tempId: state.tempId });
    state.tempId = null;
  }

  // Mouse / touch
  canvas.addEventListener('mousedown', e => startDraw(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => {
    // cursor broadcast
    sendCursor(e.clientX, e.clientY);
    if(state.drawing) moveDraw(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0]; startDraw(t.clientX, t.clientY);
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    const t = e.touches[0]; moveDraw(t.clientX, t.clientY);
    sendCursor(t.clientX, t.clientY);
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', endDraw);

  // Resize
  const ro = new ResizeObserver(resize);
  ro.observe(document.querySelector('main'));

  // Cursor indicators
  function ensureCursor(userId, color){
    if(state.remoteCursors[userId]) return state.remoteCursors[userId];
    const el = document.createElement('div');
    el.className = 'cursor-dot';
    el.style.background = color || '#fff';
    document.querySelector('main').appendChild(el);
    state.remoteCursors[userId] = { x:0, y:0, el, color };
    return state.remoteCursors[userId];
  }
  function updateCursor(userId, x, y, color){
    const c = ensureCursor(userId, color);
    c.x = x; c.y = y;
    const pt = screenToCanvas(x,y);
    c.el.style.left = x + 'px';
    c.el.style.top = y + 'px';
  }

  // Throttled cursor sending
  let lastCursorTs = 0;
  function sendCursor(x,y){
    const now = performance.now();
    if(now - lastCursorTs > 30){
      lastCursorTs = now;
      WS.emit('cursor:update', { x, y });
    }
  }

  // Socket events
  WS.on('state:replace', ({ ops }) => {
    state.ops = ops;
    redraw(state.ops);
  });

  WS.on('op:commit', ({ op }) => {
    state.ops.push(op);
    drawOp(op);
  });

  WS.on('stroke:remoteStart', ({ userId, tempId, color, width, mode }) => {
    state.liveStrokes.set(tempId, { userId, tempId, color, width, mode, points: [] });
  });
  WS.on('stroke:remotePoint', ({ tempId, x, y }) => {
    const live = state.liveStrokes.get(tempId);
    if(!live) return;
    live.points.push({x,y});
    // Only draw recent segment to reduce overdraw
    drawLiveStroke(live);
  });
  WS.on('stroke:remoteEnd', ({ tempId }) => {
    state.liveStrokes.delete(tempId);
  });

  WS.on('cursor:state', ({ cursors, users }) => {
    for(const uid in cursors){
      const c = cursors[uid];
      const user = (users||[]).find(u => u.id===uid);
      updateCursor(uid, c.x, c.y, user?.color);
    }
  });

  WS.on('presence:state', ({ users }) => {
    const ul = document.getElementById('userList');
    ul.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      li.className = 'user-item';
      li.innerHTML = `<span class="user-dot" style="background:${u.color}"></span> ${u.name}`;
      ul.appendChild(li);
    });
  });

  // expose some helpers for main.js
  window.CanvasApp = {
    resize,
    screenToCanvas
  };
})();