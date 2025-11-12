(function(){
  const name = prompt('Enter your display name')?.trim() || ('User-' + Math.floor(Math.random()*999));
  const roomId = 'lobby';

  // Join presence
  WS.emit('presence:join', { roomId, name });

  // On load/resize ensure canvas fits
  window.addEventListener('load', () => {
    CanvasApp.resize();
  });
})();