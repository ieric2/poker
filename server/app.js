var app = require('express')();
var http = require('http').createServer(app);
var uuid = require('uuid')
const PORT = 8080;
var io = require('socket.io')(http);


http.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});

io.on('connection', (socket) => {
    const uid = uuid.v4();
    console.log('new user: ' + uid);
    socket.emit('acquireUID', {
        uid: uid
    });

});

class Game {
    constructor(gid) {
        this.gid = gid;
        this.players = [];
        this.smallBlind = 1;
        this.bigBlind = 2;
        this.dealer = 0;
        this.pot = 0;
        this.isStarted = false;
    }
}

class Player {
    constructor(uid) {
        this.uid = uid;
        this.name = uid;
        this.chips = 200;
        this.cards = [];
    }
}