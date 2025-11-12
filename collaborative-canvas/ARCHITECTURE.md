# ARCHITECTURE

## Data Flow
```
Pointer/Touch events
  -> client builds a live stroke (points[], color, width, mode)
  -> emits 'stroke:start' + streaming 'stroke:point' + 'stroke:end' to server
  -> server rebroadcasts live events to others for prediction
  -> on 'stroke:end', server commits an operation (op) to the room state
  -> server broadcasts 'op:commit' (or full state on undo/redo)
  -> clients append to local op log and re-render when needed
```

## WebSocket Protocol (Socket.IO)
**Client -> Server**
- `presence:join` `{ roomId, name }`
- `cursor:update` `{ x, y }` (throttled)
- `stroke:start` `{ tempId, color, width, mode }`
- `stroke:point` `{ tempId, x, y }` (high-frequency)
- `stroke:end` `{ tempId }` (server turns this into a committed op)
- `op:undo` `{}` (global; pops last op)
- `op:redo` `{}` (global; re-applies last undone op)

**Server -> Client**
- `presence:state` `{ users: [{id, name, color}], selfId }`
- `cursor:state` `{ [userId]: {x,y} }`
- `stroke:remoteStart` `{ userId, tempId, color, width, mode }`
- `stroke:remotePoint` `{ userId, tempId, x, y }`
- `stroke:remoteEnd` `{ userId, tempId }`
- `op:commit` `{ op }`
- `state:replace` `{ ops }` (used on undo/redo or resync)

## Undo/Redo Strategy (Global)
- Each room holds a **single op log** (array of committed operations) and a **redo stack**.
- `undo` removes the last op from the log and pushes it to redo.
- `redo` pops from redo and appends back to the log.
- Any user can trigger undo/redo; the server is authoritative and broadcasts `state:replace` with the current op list to keep everyone consistent.

## Conflict Resolution
- **Ordering**: Server commit order is the canonical order (last-writer-wins).
- **Eraser**: Implemented by drawing with `globalCompositeOperation='destination-out'` on the client. This naturally handles overlaps.
- **Live Strokes**: While drawing, clients render locally (prediction) and remote live strokes are rendered on the fly. On commit, the final op is added to the op log.

## Performance Notes
- Points are streamed and batched visually using requestAnimationFrame on the client to avoid overdraw.
- Redraws clear the canvas and replay the op log on structural changes (undo/redo, resize). Incremental live drawing doesn’t require full replay.
