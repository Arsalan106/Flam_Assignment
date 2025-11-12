// Simple Socket.IO wrapper
window.WS = (function(){
  const socket = io({ path: '/socket.io' });

  function on(event, handler){ socket.on(event, handler); }
  function emit(event, payload){ socket.emit(event, payload); }

  return { on, emit, socket };
})();
