var express = require("express");
const { Z_ASCII } = require("zlib");
var app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
server.listen(process.env.PORT || 8080);
server.setTimeout(500);

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/client/index.html");
});

app.get("/game/:roomId", function (req, res) {
    res.sendFile(__dirname + "/client/game.html");
});
app.use("/client", express.static(__dirname + "/client"));

console.log("Server started.");

class Player {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.cards = [];
        this.active = true;
        this.bet = null;
        this.balance = 200;
    }
    setName(name) {
        this.name = name;
    }
}

class Game {
    constructor(id) {
        this.gameId = id;
        this.players = [];
        this.numPlayers = 0;
        this.history = [];
        this.recentBet = 0;
        this.playerTurn = null;
        this.nextCardIndex = 0;
        this.pot = 0;
        this.phase = 0;
        this.communityCards = [];
        this.cards = [
            "2H",
            "3H",
            "4H",
            "5H",
            "6H",
            "7H",
            "8H",
            "9H",
            "10H",
            "JH",
            "QH",
            "KH",
            "AH",
            "2D",
            "3D",
            "4D",
            "5D",
            "6D",
            "7D",
            "8D",
            "9D",
            "10D",
            "JD",
            "QD",
            "KD",
            "AD",
            "2S",
            "3S",
            "4S",
            "5S",
            "6S",
            "7S",
            "8S",
            "9S",
            "10S",
            "JS",
            "QS",
            "KS",
            "AS",
            "2C",
            "3C",
            "4C",
            "5C",
            "6C",
            "7C",
            "8C",
            "9C",
            "10C",
            "JC",
            "QC",
            "KC",
            "AC",
        ];
        this.gameInProgress = false;
    }
    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);
        if (index > -1) {
            this.players.splice(index, 1);
            this.numPlayers--;
        }
        console.log("removed");
    }
    addPlayer(playerId) {
        this.players.push(playerId);
        this.numPlayers++;
        console.log(playerId + " joined game: " + this.gameId);
    }

    shuffle() {
        var currentIndex = this.cards.length, temporaryValue, randomIndex;
      
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
      
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
      
          // And swap it with the current element.
          temporaryValue = this.cards[currentIndex];
          this.cards[currentIndex] = this.cards[randomIndex];
          this.cards[randomIndex] = temporaryValue;
        }
      
      }
}
var socketList = {};
var playerList = {};
var gameList = {};

var playerArray = [];
var gameArray = [];

function createPlayer(socket) {
    playerList[socket.realId] = new Player(socket.realId);
    playerArray.push(socket.realId);
}

function joinGame(socket, gameId) {
    if (gameArray.includes(gameId)) {
        socket.join(gameId);
        socket.gameId = gameId;
        if (gameList[gameId].players.indexOf(socket.realId) == -1) {
            gameList[gameId].addPlayer(socket.realId);
        }
        url = "/game/" + gameId;

        io.to(socket.realId).emit("redirect", url);

        io.to(socket.gameId).emit("addToChat", playerList[socket.realId].name + " has joined the game");
        updatePlayerArray(gameId);
    } else {
        socket.emit("invalid", "Room does not exist");
    }
}

function createGame(socket, gameId) {
    if (gameArray.includes(gameId)) {
        socket.emit("invalid", "Room already exists");
        return -1;
    } else {
        console.log("game created: " + gameId);
        gameArray.push(gameId);
        gameList[gameId] = new Game(gameId);
        joinGame(socket, gameId);
    }
}

function drawCards(gameId) {
    for (i in playerList) {
        playerList[i].cards = [];
        for (var n = 0; n < 2; n++) {
            card = gameList[gameId].cards[gameList[gameId].nextCardIndex++];
            playerList[i].cards.push(card);
        }
    }
}

function setupHand(gameId) {
    gameList[gameId].shuffle();
    gameList[gameId].recentBet = 0;
    //TODO:: fix playerturn
    gameList[gameId].playerTurn = 0;    
    gameList[gameId].nextCardIndex = 0;
    gameList[gameId].pot = 0;
    gameList[gameId].history = [];

    drawCards(gameId);

    for (var i in gameList[gameId].players) {
        const playerId = gameList[gameId].players[i];
        io.to(playerId).emit("newHand", {
            cards: playerList[playerId].cards,
        });
        updatePlayerArray(gameId);
    }
}

function convertCardValue(value) {
    switch (value) {
        case "10":
            return 10;
        case "J":
            return 11;
        case "Q":
            return 12;
        case "K":
            return 13;
        case "A":
            return 14;
        default:
            return + value;
    }
}

function updatePlayerArray(gameId) {
    let playerNames = [];
    for (let i = 0; i < gameList[gameId].players.length; i++) {
        playerNames.push(playerList[gameList[gameId].players[i]].name);
    }
    io.to(gameId).emit("updatePlayerArray", {
        playerNames: playerNames,
        playerIds: gameList[gameId].players,
        playerTurn: gameList[gameId].playerTurn,
    });
}

function calculateHandValue(gameId, playerId) {
    let player = playerList[playerId];
    let cards = player.cards.concat(gameList[gameId].communityCards);

    console.log(cards)

    let numCounts = [];
    let suitCounts = { H: 0, D: 0, C: 0, S: 0 };
    let suits = Object.keys(suitCounts)

    for (let i = 2; i <= 14; i++) {
        numCounts[i] = 0;
    }

    for (var i = 0; i < cards.length; i++) {
        if (cards[i].length == 3) {
            num = convertCardValue(cards[i].substring(0, 2));
            suit = cards[i].charAt(2);
        } else {
            num = convertCardValue(cards[i].charAt(0));
            suit = cards[i].charAt(1);
        }
        numCounts[num]++;
        suitCounts[suit]++;
    }

    console.log(suitCounts)
    console.log(numCounts)

    //royalFlush
    let startIndex = 14;
    let royalFlushFlag = true;
    for (var i = 0; i < 5; i++) {
        if (numCounts[startIndex - i] < 1) {
            royalFlushFlag = false;
            break;
        }
    }
    if (royalFlushFlag) {
        for (let suit of suits) {
            if (suitCounts[suit] >= 5) {
                return 900000000;
            }
        }
    }
    //straightFlush
    for (let startIndex = 14; startIndex >= 5; startIndex--) {
        let straightFlushFlag = true;
        for (let i = 0; i < 5; i++) {
            if (startIndex - i == -1) {
                if (numCounts[14] < 1) {
                    straightFlushFlag = false;
                    break;
                }
            } 
            else if (numCounts[startIndex - i] < 1) {
                straightFlushFlag = false;
                break;
            }
        }
        if (straightFlushFlag) {
            for (let suit of suits) {
                if(suitCounts[suit] >= 5) {
                    return 800000000 + startIndex;
                }
            }
        }
    }
    //quad
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 4) {
            for (let j = 14; j >= 2; j--) {
                if (numCounts[j] >= 1 && j != i) {
                    return 700000000 + 100 * i + j;
                }
            }
        }
    }
    //full house
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 3) {
            for (let j = 14; j >= 2; j--) {
                if (j != i && numCounts[j] >= 2) {
                    return 600000000 + 100 * i + j;
                }
            }
        }
    }
    //flush
    for (let suit of suits) {
        if (suitCounts[suit] >= 5) {
            for (let i = 14; i >= 2; i--) {
                if (numCounts[i] >= 1) {
                    return 500000000 + i;
                }
            }
        }
    }
    //straight
    for (let startIndex = 14; startIndex >= 5; startIndex--) {
        let straightFlag = true;
        for (var i = 0; i < 5; i++) {
            if (startIndex - i == -1) {
                if (numCounts[14] < 1) {
                    straightFlag = false;
                    break;
                }
            } 
            else if (numCounts[startIndex - i] < 1) {
                straightFlag = false;
                break;
            }
        }
        if (straightFlag) {
            return 400000000 + startIndex;
        }       
    }
    //trips
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 3) {
            for (let j = 14; j >= 2; j--) {
                if(numCounts[j] >= 1 && j != i) {
                    for (let k = j - 1; k >= 2; k--) {
                        if(numCounts[k] >= 1 && k != i) {
                            return 300000000 + 10000 * i + 100 * j + k;
                        }
                    }
                }
            }
        }       
    }
    //two pair
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 2) {
            for (let j = i - 1; j >= 2; j--) {
                if (numCounts[j] >= 2) {
                    for (let k = 14; k >= 2; k--) {
                        if (k != i && k != j) {
                            return 200000000 + 10000 * i + 100 * j + k;
                        }
                    }
                }
            }
        }       
    }
    //pair
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 2) {
            return 100000000;
        }       
    }
    //high card
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 1) {
            for (let j = i - 1; j >= 2; j--) {
                if (numCounts[j] >= 1) {
                    for (let k = j - 1; k >= 2; k--) {
                        if (numCounts[k] >= 1) {
                            return i * 10000 + 100 * j + k;
                        }
                    }
                }
            }
        }
    }
   
}

function calculateHandResult(gameId) {
    let playerIds = gameList[gameId].players
    let winners = [];
    let maxScore = 0;


    for (let playerId of playerIds) {
        let curScore = calculateHandValue(gameId, playerId);
        if (curScore > maxScore) {
            winners = [];
            winners.push(playerId);
            maxScore = curScore;
        }
        else if (curScore == maxScore) {
            winners.push(playerId);
        }
    }
    console.log(winners)

    for (let playerId of winners) {
        playerList[playerId].balance += gameList[gameId].pot / winners.length;
        io.to(playerId).emit('setBalance', {
            balance: playerList[playerId].balance
        })
    }
    io.to(gameId).emit('setPot', {
        pot: 0
    })

    setupHand(gameId)    

}

//where 0 - preflop betting, 1 - flop betting, 2 - turn betting, 3 - river betting
function setNextPhase(gameId) {
    let curPhase = gameList[gameId].phase;
    let dealtCards = [];
    if (curPhase == 3) {
        calculateHandResult(gameId);
    }
    else {
        if (curPhase == 0) {
            for (var n = 0; n < 3; n++) {
                card = gameList[gameId].cards[gameList[gameId].nextCardIndex++];
                dealtCards.push(card);
            }
            io.to(gameId).emit('flop', {
                cards: dealtCards
            })
        }
        else if (curPhase == 1) {
            card = gameList[gameId].cards[gameList[gameId].nextCardIndex++];
            dealtCards.push(card);
            io.to(gameId).emit('turn', {
                cards: dealtCards
            })
        }
        else if (curPhase == 2) {
            card = gameList[gameId].cards[gameList[gameId].nextCardIndex++];
            dealtCards.push(card);
            io.to(gameId).emit('river', {
                cards: dealtCards
            })
        }
        gameList[gameId].communityCards = gameList[gameId].communityCards.concat(dealtCards);    
        gameList[gameId].phase++; 
        gameList[gameId].history = [];
        gameList[gameId].recentBet = 0;
        let players = gameList[gameId].players
        for (let playerId of players) {
            playerList[playerId].bet = null;
        }
    }
}

function calculateNextTurn(gameId) {
    let players = gameList[gameId].players;
    let numPlayers = gameList[gameId].numPlayers;
    let curTurn = gameList[gameId].playerTurn;
    let curBet = gameList[gameId].recentBet;
    //check if betting round is over
    let pointer = (curTurn + 1) % numPlayers;
    while(pointer != curTurn) {
        let player = playerList[players[pointer]];
        //player has folded
        if (player.bet == 0) {
            pointer = (pointer + 1) % numPlayers;
        }
        else if (curBet == 0) {
            console.log('edge case??')
        }
        else {
            
            //found player to take next turn;
            if (player.bet == null || player.bet < curBet) {
                gameList[gameId].playerTurn = pointer;
                return;
            }
            //betting phase is over
            else if (player.bet == curBet) {
                setNextPhase(gameId);
                return;
            }

        }
    }
    //this means everyone has folded TODO
    calculateHandResult(gameId);
}

io.on("connection", function (socket) {
    socket.on("startSession", function (data) {
        console.log("starting session");

        if (data.sessionId == null || !playerArray.includes(data.sessionId)) {
            socket.realId = socket.id;
            socketList[socket.id] = socket;

            createPlayer(socket);
            console.log("new session");
        } else {
            socket.realId = data.sessionId;
            playerList[socket.realId].active = true;
            if (gameArray.includes(data.gameId)) {
                socket.emit("resetState", {
                    cards: playerList[socket.realId].cards,
                    lives: playerList[socket.realId.lives],
                    gameInProgress: gameList[data.gameId].gameInProgress,
                });
            }
        }
        socket.join(socket.realId);
        socket.emit("sessionAck", { sessionId: socket.realId });
    });

    socket.on("roomEntered", function (data) {
        console.log("room entered");
        if (createGame(socket, data.gameId) == -1) {
            joinGame(socket, data.gameId);
        }
    });

    socket.on("createGame", function (data) {
        console.log("create game");
        createGame(socket, data.gameId);
    });

    socket.on("joinGame", function (data) {
        console.log("join game");
        joinGame(socket, data.gameId);
    });

    socket.on("setName", function (data) {
        if (gameArray.includes(data.gameId)) {
            console.log("setting name: " + data.name);
            playerList[socket.realId].setName(data.name);
            updatePlayerArray(data.gameId);
        }
    });

    socket.on("startGame", function (data) {
        if (gameList[data.gameId].numPlayers > 1) {
            gameList[data.gameId].gameInProgress = true;
            io.to(data.gameId).emit("displayPlayButtons");
            io.to(data.gameId).emit("clearChat");
            updatePlayerArray(data.gameId);

            setupHand(data.gameId);
        } 
        else {
            io.to(data.gameId).emit("addToChat", "<b> not enough people <b>");
        }
    });

    socket.on("playTurn", function (data) {
        //cast the string to int
        data.bet = + data.bet;
        if (socket.realId == playerArray[gameList[socket.gameId].playerTurn]) {
            //bet needs to be greater than previous bet.
            if (data.bet != 0 && data.bet < gameList[socket.gameId].recentBet) {
                socket.emit("addToChat", "<b> Invalid Bet <b>");
                return -1;
            }
            playerList[socket.realId].bet = data.bet;
            playerList[socket.realId].balance -= data.bet;

            gameList[data.gameId].pot += data.bet;
            io.to(data.gameId).emit('setPot', {
                pot: gameList[data.gameId].pot
            })

            socket.emit('setBalance', {
                balance:playerList[socket.realId].balance
            });

            //fold
            if (data.bet == 0) {
                message = playerList[socket.realId].name + " folded";
            }
            //call
            else if (data.bet == gameList[socket.gameId].recentBet) {
                message = playerList[socket.realId].name + " called";
            }
            //raise
            else {
                gameList[socket.gameId].recentBet = data.bet;
                message = playerList[socket.realId].name + " bet: " + data.bet;
            }

            gameList[socket.gameId].history.push({
                playerId: socket.realId,
                bet: data.bet,
                message: message,
            });

            io.to(data.gameId).emit("updateGame", {
                pastMoveText: gameList[socket.gameId].history[gameList[socket.gameId].history.length - 1].message,
            });

            //get next player turn from folds and such
            calculateNextTurn(data.gameId);
            updatePlayerArray(data.gameId);
        } else {
            socket.emit("addToChat", "<b> not your turn <b>");
        }
    });

    socket.on("checkHand", function (data) {
        if (gameList[data.gameId].playerTurn == null) {
            socket.emit("addToChat", "<b> game has not started yet <b>");
        } else {
            //true if there is that hand
            handValidity = checkHand(data.gameId);
            //console.log(handValidity);
            doubtValidity = "CORRECTLY";
            if (handValidity) {
                doubtValidity = "INCORRECTLY";
                playerList[socket.realId].lives--;
                //change turn to player who doubted
                gameList[data.gameId].playerTurn = gameList[data.gameId].players.indexOf(socket.realId);
            } else {
                playerList[
                    playerArray[(playerArray.length + gameList[data.gameId].playerTurn - 1) % playerArray.length]
                ].lives--;
                //need to change turn to player who just played turn
                gameList[data.gameId].playerTurn =
                    (gameList[data.gameId].playerTurn + gameList[data.gameId].numPlayers - 1) %
                    gameList[data.gameId].numPlayers;
            }

            io.to(data.gameId).emit(
                "addToChat",
                "<b> " +
                    playerList[socket.realId].name +
                    " " +
                    doubtValidity +
                    " doubted " +
                    gameList[data.gameId].history[gameList[data.gameId].history.length - 1][0] +
                    "'s hand </b>"
            );
            for (i in playerList) {
                io.to(data.gameId).emit("addToChat", playerList[i].name + " had: " + playerList[i].cards);
            }

            setupHand(data.gameId);
        }
    });

    socket.on("chat", function (data) {
        io.to(data.gameId).emit("addToChat", playerList[socket.realId].name + ": " + data.text);
    });

    socket.on("disconnect", function (data) {
        if (playerArray.includes(socket.realId)) {
            playerList[socket.realId].active = false;
            setTimeout(function () {
                if (playerList[socket.realId] == undefined || !playerList[socket.realId].active) {
                    io.to(socket.gameId).emit(
                        "addToChat",
                        "<b> " + playerList[socket.realId].name + " has left the game <b>"
                    );
                    gameList[socket.gameId].removePlayer(socket.realId);
                    if (gameList[socket.gameId].numPlayers == 0) {
                        delete gameList[socket.gameId];
                        const index = gameArray.indexOf(socket.gameId);
                        if (index > -1) {
                            gameArray.splice(index);
                        }
                    }
                    delete socketList[socket.realId];
                    delete playerList[socket.realId];

                    const index = playerArray.indexOf(socket.realId);
                    if (index > -1) {
                        playerArray.splice(index);
                    }
                    if (gameList[socket.gameId] != undefined) {
                        updatePlayerArray(socket.gameId);
                    }
                }
            }, 1000);
        }
    });
});
