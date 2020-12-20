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
    constructor(id, isBot) {
        this.id = id;
        this.name = id;
        this.cards = [];
        this.active = true;
        this.bet = null;
        this.balance = 200;
        this.isBot = isBot;
        this.inHand = true;
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
        this.dealerId = null;
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
//map of playerId to player Object
var playerList = {};
var gameList = {};
var playerArray = [];
var gameArray = [];
var botId = 1230;
function createPlayer(socket) {
    playerList[socket.realId] = new Player(socket.realId, false);
    playerArray.push(socket.realId);
}
function createBotPlayer(socket, gameId) {
    playerList[botId] = new Player(botId, true);
    playerList[botId].setName("Buddy the Bot");
    playerArray.push(botId);
    console.log("created bot");
    
    if (gameList[gameId].players.indexOf(botId) == -1) {
        gameList[gameId].addPlayer(botId);
    }
    io.to(socket.gameId).emit("addToChat", playerList[botId].name + " has joined the game");
    updatePlayerArray(gameId);
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
    gameList[gameId].dealerId = 0;    
    gameList[gameId].nextCardIndex = 0;
    gameList[gameId].pot = 0;
    gameList[gameId].history = [];
    gameList[gameId].communityCards = [];
    drawCards(gameId);
    for (var i in gameList[gameId].players) {
        const playerId = gameList[gameId].players[i];
        playerList[playerId].inHand = true;
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
    io.to(gameId).emit('updateGame', {
        text: '' + playerId + ' had: ' + cards
    })
    
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
            if (startIndex - i == 1) {
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
                        if (numCounts[k] >= 1 && k != i && k != j) {
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
            for (let j = 14; j >= 2; j--) {
                if (numCounts[j] >= 1 && j != i) {
                    for (let k = j - 1; k >= 2; k--) {
                        if (numCounts[k] >= 1 && k != i) {
                            for (let z = k - 1; z >= 2; z--) {
                                if (numCounts[z] >= 1 && z != i) {
                                    return 100000000 + 1000000 * i + 10000 * j + 100 * k + z;
                                }
                            }
                        }
                    }
                }
            }
        }       
    }
    //high card
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 1) {
            for (let j = i - 1; j >= 2; j--) {
                if (numCounts[j] >= 1) {
                    for (let k = j - 1; k >= 2; k--) {
                        if (numCounts[k] >= 1) {
                            for (let l = k - 1; l >= 2; l--) {
                                if (numCounts[l] >= 1) {
                                    return i * 1000000 + 10000 * j + 100 * k + l;
                                }
                            }
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
        if (playerList[playerId].bet == 0) {
            continue;
        }
        let curScore = calculateHandValue(gameId, playerId);
        console.log(playerId + ": " + curScore)
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
    let winnerText = '';
    if (winners.length == 1) {
        winnerText = playerList[winners[0]].name + ' won the pot';
    }
    else {
        for (let winner of winners) {
            winnerText += playerList[winner].name + ', ';
        }
        winnerText += 'split the pot';
    }
    io.to(gameId).emit('updateGame', {
        text: winnerText
    })
    setupHand(gameId)    
}
//where 0 - preflop betting, 1 - flop betting, 2 - turn betting, 3 - river betting
function setNextPhase(socket, gameId) {
    let curPhase = gameList[gameId].phase;
    console.log('curPhase ' + curPhase)
    let dealtCards = [];
    if (curPhase == 3) {
        var curDealer = gameList[gameId].dealerId;
        gameList[gameId].dealerId = (curDealer + 1) % numPlayers;
        gameList[gameId].playerTurn = gameList[gameId].dealerId;
        calculateHandResult(gameId);
        gameList[gameId].phase = 0;
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

function calculateNextTurn(socket, gameId) {
    let players = gameList[gameId].players;
    let numPlayers = gameList[gameId].numPlayers;
    let curTurn = gameList[gameId].playerTurn;
    let curBet = gameList[gameId].recentBet;
    //check if betting round is over
    let pointer = (curTurn + 1) % numPlayers;
    console.log(curTurn)
    while(pointer != curTurn) {
        let player = playerList[players[pointer]];
        //player has folded
        if (player.bet == -1) {
            pointer = (pointer + 1) % numPlayers;
        }
        else {
            
            //found player to take next turn;
            if (player.bet == null || player.bet < curBet) {
                gameList[gameId].playerTurn = pointer;
                if (botId == playerArray[gameList[gameId].playerTurn]) {	
                    botTurn(socket);	
                }
                return;
            }
            //betting phase is over( there are 4 betting phases in a hand)
            else if (player.bet == curBet) {
                setNextPhase(socket, gameId);
                if (botId == playerArray[gameList[gameId].playerTurn]) {
                    botTurn(socket);
                }
                return;
            }

        }
    }
    console.log('everyone has folded?')
    //this means everyone has folded TODO
    calculateHandResult(gameId);
}

function botTurn(socket) {	
    let botHandVal = calculateHandValue(socket.gameId, botId);	
    let recentBet = gameList[socket.gameId].recentBet;	
    let bet = calculateBotBet(recentBet, botHandVal);	
    console.log("bot turn bet = " + bet);	
    // console.log("bot cur hand val = " + botHandVal);	
    playerList[botId].bet = bet;	
    playerList[botId].balance -= bet;	
     	
    gameList[socket.gameId].pot += bet;	
    io.to(socket.gameId).emit('setPot', {	
        pot: gameList[socket.gameId].pot	
    })	
    socket.emit('setBalance', {	
        balance:playerList[botId].balance	
    });	
    //fold	
    if (bet == -1) {	
        message = playerList[botId].name + " folded";	
        playerList[socket.realId].inhand = false;
        // console.log("bot folded");	
    }	
    //call	
    else if (bet == recentBet) {	
        message = playerList[botId].name + " called";	
        // console.log("bot called");	
    }	
    //raise	
    else {	
        gameList[socket.gameId].recentBet = bet;	
        message = playerList[botId].name + " bet: " + bet;	
        // console.log("bot raised");	
    }	
    gameList[socket.gameId].history.push({	
        playerId: botId,	
        bet: bet,	
        message: message,	
    });	
    io.to(socket.gameId).emit("updateGame", {	
        text: gameList[socket.gameId].history[gameList[socket.gameId].history.length - 1].message,	
    });	
    //get next player turn from folds and such	
    calculateNextTurn(socket, socket.gameId);	
    updatePlayerArray(socket.gameId);	
}	
function calculateBotBet(recentBet, botHandVal) {	
    //fix this later 	
    //check all in behavior	
    //change it to % of recentBet instead of numbers	
    let bet = 0;	
    if (botHandVal == undefined) {	
        bet = recentBet + 1;	
    } else if (botHandVal < 100000000) {	
        bet = recentBet;	
    } else if (botHandVal < 200000000) {	
        bet = recentBet + 1;	
    } else if (botHandVal < 300000000) {	
        bet = recentBet + 2;	
    } else if (botHandVal < 400000000) {	
        bet = recentBet + 3;	
    } else if (botHandVal < 500000000) {	
        bet = recentBet + 4;	
    } else if (botHandVal < 600000000) {	
        bet = recentBet + 5;	
    } else if (botHandVal < 700000000) {	
        bet = recentBet + 6;	
    } else if (botHandVal < 800000000) {	
        bet = recentBet + 7;	
    } else if (botHandVal < 900000000) {	
        bet = recentBet + 8;	
    }	
    	
    if (bet > playerList[botId].balance) {	
        if (playerList[botId].balance < recentBet) {	
            return 0;	
        }	
        return playerList[botId].balance;	
    }	
    return bet;	
    	
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
    	
    socket.on("playWithBot", function (data) {	
        console.log("called play with bot");	
        createBotPlayer(socket, data.gameId);	
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
            //set call behavior
            if (data.bet === -2) {
                data.bet = gameList[socket.gameId].recentBet
            }
            if (data.bet !== -1) {
                let betDiff = data.bet - playerList[socket.realId].bet;
                playerList[socket.realId].bet = data.bet;
                playerList[socket.realId].balance -= betDiff;
    
                gameList[data.gameId].pot += betDiff;
                io.to(data.gameId).emit('setPot', {
                    pot: gameList[data.gameId].pot
                })
    
                socket.emit('setBalance', {
                    balance:playerList[socket.realId].balance
                });
            }

            //fold
            if (data.bet == -1) {
                message = playerList[socket.realId].name + " folded";
                playerList[socket.realId].inhand = false;
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
                text: gameList[socket.gameId].history[gameList[socket.gameId].history.length - 1].message,
            });

            //get next player turn from folds and such
            calculateNextTurn(socket, data.gameId);
            updatePlayerArray(data.gameId);
        } else {
            socket.emit("addToChat", "<b> not your turn <b>");
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
