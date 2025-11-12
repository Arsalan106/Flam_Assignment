const { DrawingState } = require('./drawing-state');

class Rooms {
  constructor(){
    this.rooms = new Map(); // roomId -> { state: DrawingState, users: Map(userId -> {name,color}) }
  }
  ensure(roomId){
    if(!this.rooms.has(roomId)){
      this.rooms.set(roomId, { state: new DrawingState(), users: new Map() });
    }
    return this.rooms.get(roomId);
  }
  addUser(roomId, user){
    const r = this.ensure(roomId);
    r.users.set(user.id, user);
    return r;
  }
  removeUser(roomId, userId){
    const r = this.ensure(roomId);
    r.users.delete(userId);
    return r;
  }
  userList(roomId){
    const r = this.ensure(roomId);
    return Array.from(r.users.values());
  }
}

module.exports = { Rooms };
