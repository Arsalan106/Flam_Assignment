const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Rooms } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { path: '/socket.io', cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const rooms = new Rooms();

const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7','#ec4899','#22c55e','#eab308','#06b6d4'];

app.use('/client', express.static(path.join(__dirname, '..', 'client')));

app.get('/', (_req,res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

io.on('connection', (socket) => {
  let roomId = null;
  let user = null;

  socket.on('presence:join', ({ roomId: rid, name }) => {
    roomId = String(rid || 'lobby');
    const color = COLORS[Math.floor(Math.random()*COLORS.length)];
    user = { id: socket.id, name: name || 'Anonymous', color };
    rooms.addUser(roomId, user);
    socket.join(roomId);

    // Send presence + initial state to the new client
    socket.emit('presence:state', { users: rooms.userList(roomId), selfId: socket.id });
    const { state } = rooms.ensure(roomId);
    socket.emit('state:replace', state.snapshot());

    // Broadcast presence to others
    socket.to(roomId).emit('presence:state', { users: rooms.userList(roomId) });
  });

  socket.on('cursor:update', ({ x, y }) => {
    if(!roomId) return;
    const { state } = rooms.ensure(roomId);
    state.cursors[socket.id] = { x, y };
    // Fanout cursor state (could be optimized to deltas; OK for demo)
    const users = rooms.userList(roomId);
    io.to(roomId).emit('cursor:state', { cursors: state.cursors, users });
  });

  // Live stroke streaming
  socket.on('stroke:start', ({ tempId, color, width, mode }) => {
    if(!roomId) return;
    socket.to(roomId).emit('stroke:remoteStart', { userId: socket.id, tempId, color, width, mode });
    socket.data.liveStroke = { tempId, color, width, mode, points: [] };
  });

  socket.on('stroke:point', ({ tempId, x, y }) => {
    if(!roomId) return;
    // Relay to others
    socket.to(roomId).emit('stroke:remotePoint', { tempId, x, y });
    // Collect for commit
    if(socket.data.liveStroke && socket.data.liveStroke.tempId === tempId){
      socket.data.liveStroke.points.push({ x, y });
    }
  });

  socket.on('stroke:end', ({ tempId }) => {
    if(!roomId) return;
    socket.to(roomId).emit('stroke:remoteEnd', { tempId });
    const live = socket.data.liveStroke;
    if(live && live.tempId === tempId){
      const { state } = rooms.ensure(roomId);
      const op = state.commitOp({ ...live, userId: socket.id });
      io.to(roomId).emit('op:commit', { op });
      socket.data.liveStroke = null;
    }
  });

  // Global undo/redo
  socket.on('op:undo', () => {
    if(!roomId) return;
    const { state } = rooms.ensure(roomId);
    if(state.undo()){
      state.replaceState(io, roomId);
    }
  });

  socket.on('op:redo', () => {
    if(!roomId) return;
    const { state } = rooms.ensure(roomId);
    if(state.redoOp()){
      state.replaceState(io, roomId);
    }
  });

  socket.on('disconnect', () => {
    if(roomId && user){
      rooms.removeUser(roomId, user.id);
      io.to(roomId).emit('presence:state', { users: rooms.userList(roomId) });
    }
  });
});

server.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
