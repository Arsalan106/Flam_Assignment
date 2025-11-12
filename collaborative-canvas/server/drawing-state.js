const { v4: uuidv4 } = require('uuid');

class DrawingState {
  constructor(){
    this.ops = [];
    this.redo = [];
    this.cursors = {}; // userId -> {x,y}
  }

  commitOp(op){
    const finalOp = {
      id: uuidv4(),
      points: op.points || [],
      color: op.color || '#000',
      width: op.width || 4,
      mode: op.mode || 'brush',
      userId: op.userId,
      ts: Date.now()
    };
    this.ops.push(finalOp);
    this.redo = []; // invalidate redo on new op
    return finalOp;
  }

  undo(){
    if(this.ops.length === 0) return false;
    const last = this.ops.pop();
    this.redo.push(last);
    return true;
  }

  redoOp(){
    if(this.redo.length === 0) return false;
    const op = this.redo.pop();
    this.ops.push(op);
    return true;
  }

  replaceState(io, room){
    io.to(room).emit('state:replace', { ops: this.ops });
  }

  snapshot(){
    return { ops: this.ops };
  }
}

module.exports = { DrawingState };
