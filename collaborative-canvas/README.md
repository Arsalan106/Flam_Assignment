# Real-Time Collaborative Drawing Canvas

A multi-user drawing app where multiple people can draw simultaneously on the same canvas with real-time synchronization.

## ✨ Features
- Brush & eraser, color picker, stroke width
- Real-time sync of strokes as they're drawn (low-latency streaming)
- Live cursor indicators for all users
- Global undo/redo across all users (server-authoritative)
- Online users list with assigned colors
- Room support (default `lobby`)

## 🚀 Quick Start
```bash
# 1) Install deps
npm install

# 2) Start server
npm start
# or live-reload
npm run dev
```

Now open http://localhost:3000 in two or more browser windows to test.

## 🧪 Testing with Multiple Users
Open several tabs or different browsers pointing to `http://localhost:3000`. Type a different display name in each tab when prompted. Draw and watch everyone’s strokes in real time. Try undo/redo from any tab and observe the global effect.

## ⚠️ Known Limitations
- For simplicity, undo/redo broadcasts the current operation list to all clients. This is acceptable for small to medium sessions but could be optimized with deltas/chunking.
- Canvas is re-rendered from the op log on undo/redo/resize; very large histories may impact performance.
- Network partitions may briefly desync; the server’s state is the source of truth and clients resync on reconnect.

## ⏱️ Time Spent
~6–8 hours for end-to-end implementation + docs.

