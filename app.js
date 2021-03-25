const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");
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
//console.log("Server started.");

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
        this.called = false;
        this.playerTurn = null;
        this.dealerId = null;
        this.nextCardIndex = 0;
        this.pot = 0;
        this.phase = 0;
        this.communityCards = [];
        this.startTimeMs = Date.now();
        this.endTimeMs = 0;
        this.endPhase = 0;
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
        playerDataList[playerId] = new PlayerData(playerId);
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
    setEndTimeMs() {
        this.endTimeMs = Date.now();
    }
    setEndPhase(phase) {
        this.endPhase = phase;
    }
}
class PlayerData {
    constructor(playerId) {
        this.playerId = playerId;
        this.avgGameLength = null;
        this.numFolds = 0;
        this.numWins = 0;
        this.numGames = 0;
        this.highestBid = null;
        this.lowestBid = null;
        this.avgTimeToBet = null;
        this.lastTimeToBet = 0;
        this.numBets = 0;
        this.turnStartTime = Date.now();
        this.turnEndTime = 0;
        //this.games = null;
    }
    setAvgGameLength(curLength) {
        if (this.avgGameLength == null) {
            this.avgGameLength = curLength;
        } else {
            this.avgGameLength = ((this.avgGameLength * this.numGames) + curLength) / (this.numGames + 1);
        }
        this.addGame();
    }
    setPlayerBidValues(currBid) {
        if (this.lowestBid == null || currBid < this.lowestBid) {
            if (currBid > 0) {
                this.lowestBid = currBid;
            }
        } 
        if (this.highestBid == null || currBid > this.highestBid) {
            this.highestBid = currBid;
        }
    }
    addGame() { //only used within class
        this.numGames++;
    }
    addWin() {
        this.numWins++;
    }
    addFold() {
        this.numFolds++;
    }
    setLastTimeToBet(turnLength) {
        this.lastTimeToBet = turnLength;
        if (this.avgTimeToBet == null) {
            this.avgTimeToBet = turnLength;
            console.log("turnLength 1st: " + turnLength);
            console.log("avgTime 1st: " + this.avgTimeToBet);
        } else {
            console.log("turnLength: " + turnLength);
            console.log("numBets: " + this.numBets);
            console.log("avgTime: " + this.avgTimeToBet);
            this.avgTimeToBet = ((this.avgTimeToBet * this.numBets) + turnLength) / (this.numBets + 1);            
        }
        this.numBets++;
    }
    setTurnStartTime() {
        this.turnStartTime = Date.now();
    }
    setTurnEndTime() {
        this.turnEndTime = Date.now();
    }
    
}

var socketList = {};
//map of playerId to player Object
var playerList = {};
var gameList = {};
var playerDataList = {};
var playerArray = [];
var gameArray = [];
var botId = 1230;
var botBluff = false;
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
    gameList[gameId].called = false;
    //TODO:: fix playerturn
    gameList[gameId].playerTurn = 0;
    gameList[gameId].dealerId = 0; 
    gameList[gameId].nextCardIndex = 0;
    gameList[gameId].pot = 0;
    gameList[gameId].history = [];
    gameList[gameId].communityCards = [];
    gameList[gameId].called = false;
    gameList[gameId].startTimeMs = Date.now();
    drawCards(gameId);
    for (var i in gameList[gameId].players) { 
        const playerId = gameList[gameId].players[i];
        playerList[playerId].inHand = true;
        playerList[playerId].bet = 0;
        io.to(playerId).emit("newHand", {
            cards: playerList[playerId].cards,
        });
        updatePlayerArray(gameId);
    }
    let randomNum = Math.floor(Math.random() * 10);
    if (randomNum == 1) {
        botBluff = true;
    }
    else {
        botBluff = false;
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
function updatePlayerBetData(playerId, currBet) {  
    playerDataList[playerId].setPlayerBidValues(currBet);
}
function updatePlayerWinCount(playerId) {
    playerDataList[playerId].addWin();
}
function updatePlayerFoldCount(playerId) {
    playerDataList[playerId].addFold();
}
function updatePlayerGameTime(playerId, gameId) {
    let gameLength = gameList[gameId].endTimeMs - gameList[gameId].startTimeMs;
    playerDataList[playerId].setAvgGameLength(gameLength);
}
function updatePlayerTimeToBet(playerId) {
    let turnLength = playerDataList[playerId].turnEndTime - playerDataList[playerId].turnStartTime;
    playerDataList[playerId].setLastTimeToBet(turnLength);
}
function printStats(playerId, gameId) {
    let length = gameList[gameId].endTimeMs - gameList[gameId].startTimeMs;

    console.log("Player Stats: ");
    console.log("Average game length: " + playerDataList[playerId].avgGameLength);
    console.log("Highest bid: " + playerDataList[playerId].highestBid);
    console.log("Lowerst bid: " + playerDataList[playerId].lowestBid);
    console.log("Average time to bet: " + playerDataList[playerId].avgTimeToBet);
    console.log("Number of wins: " + playerDataList[playerId].numWins);
    console.log("Number of folds: " + playerDataList[playerId].numFolds);

    console.log("Game " + gameId + " Stats:");
    console.log("Length: " +  length);
    console.log("Last phase in game: " + gameList[gameId].endPhase);
}
function calculateHandValue(gameId, playerId, displayHand) {
    let player = playerList[playerId];
    let cards = player.cards.concat(gameList[gameId].communityCards);
    //here we are emitting to the play history but we also want to be emitting to the card result modal
    if (gameList[gameId].phase == 3 && displayHand) {
        io.to(gameId).emit('updateGame', {
            text: '' + player.name + ' had: ' + cards
        })
        io.to(gameId).emit('sendPlayerCards', {
            cards,
            playerName: player.name,
        })    
    }
    
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
    let highCardValue = 0;
    for (let i = 14; i >= 2; i--) {
        if (numCounts[i] >= 1) {
            highCardValue += (1000000 * i)
            for (let j = i - 1; j >= 2; j--) {
                if (numCounts[j] >= 1) {
                    highCardValue += (10000 * j)
                    for (let k = j - 1; k >= 2; k--) {
                        if (numCounts[k] >= 1) {
                            highCardValue += (100 * k)
                            for (let l = k - 1; l >= 2; l--) {
                                if (numCounts[l] >= 1) {
                                    highCardValue += l;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }
    return highCardValue;
}
function calculateHandResult(gameId) {
    // console.log('calculating hand result')
    let playerIds = gameList[gameId].players
    let winners = [];
    let maxScore = 0;
    gameList[gameId].setEndTimeMs();
    gameList[gameId].setEndPhase(gameList[gameId].phase);
    for (let playerId of playerIds) {
        if (playerList[playerId].bet == -1) {
            continue;
        }
        let curScore = calculateHandValue(gameId, playerId, true);
        // console.log(curScore)
        if (curScore > maxScore) {
            winners = [];
            winners.push(playerId);
            maxScore = curScore;
        }
        else if (curScore == maxScore) {
            winners.push(playerId);
        }
    }
    for (let playerId of winners) {
        playerList[playerId].balance += gameList[gameId].pot / winners.length;
        io.to(gameId).emit('setBalance', {
            balance: playerList[playerId].balance,
            playerId
        })
        updatePlayerWinCount(playerId);
        updatePlayerGameTime(playerId, gameId);
        printStats(playerId, gameId);
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
    io.to(gameId).emit('showPlayerCards', {})
    setupHand(gameId)  
}
//where 0 - preflop betting, 1 - flop betting, 2 - turn betting, 3 - river betting
function setNextPhase(socket, gameId) {
    let curPhase = gameList[gameId].phase;
    let dealtCards = [];
    if (curPhase == 3) {
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
        gameList[gameId].called = false;
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
    //checking if everyone folded
    let numActivePlayers = 0;
    for (let i = 0; i < players.length; i++) {

        if (playerList[players[i]].bet !== -1) {
            numActivePlayers++;
        }
    }
    if (numActivePlayers == 1) {
        //console.log('everyone folded??');
        gameList[gameId].phase = 3;
        setNextPhase(socket, gameId);
        return;
    }


    //check if betting round is over
    let pointer = (curTurn + 1) % numPlayers;
    while(pointer != curTurn) {
        let player = playerList[players[pointer]];
        //player has folded
        if (player.bet == -1) {
            pointer = (pointer + 1) % numPlayers;
            updatePlayerFoldCount();
        }
        else {
            //found player to take next turn;
            if (player.bet == null || player.bet < curBet) {
                gameList[gameId].playerTurn = pointer;
                if (playerList[players[pointer]].isBot) {
                    //botId == playerArray[gameList[gameId].playerTurn]) {	
                    botTurn(socket);
                }
                else {
                    playerDataList[playerArray[gameList[gameId].playerTurn]].setTurnStartTime();
                }
                return;
            }
            //betting phase is over( there are 4 betting phases in a hand)
            else if (player.bet == curBet) {
                setNextPhase(socket, gameId);
                gameList[gameId].playerTurn = gameList[gameId].dealerId;
                playerDataList[playerArray[gameList[gameId].playerTurn]].setTurnStartTime();
                return;
            }

        }
    }
    //this means everyone has folded TODO
    calculateHandResult(gameId);
}

function botTurn(socket) {
    let botHandVal = calculateHandValue(socket.gameId, botId, false);
    console.log("botBluff" + botBluff);	
    if (botBluff) {
        botHandVal = 700000000;
    }
    let recentBet = gameList[socket.gameId].recentBet;	
    let called = gameList[socket.gameId].called;
    let bet = calculateBotBet(recentBet, called, botHandVal, socket.gameId);	
    console.log("bot turn bet = " + bet);	
    playerList[botId].bet = bet;	
    playerList[botId].balance -= bet;	
     	
    gameList[socket.gameId].pot += bet;	
    io.to(socket.gameId).emit('setPot', {	
        pot: gameList[socket.gameId].pot	
    })	
    io.to(socket.gameId).emit('setBalance', {	
        balance:playerList[botId].balance,
        playerId: botId	
    });	
    //fold	
    if (bet == -1) {	
        message = playerList[botId].name + " folded";	
        playerList[botId].bet = bet;
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

function calculateBotBet(recentBet, called, botHandVal, gameId) {	
    //fix this later 	
    //check all in behavior	
    let curPhase = gameList[gameId].phase;
    let bet = 0;	
    if (curPhase == 0) { //preflop betting
        let cards = playerList[botId].cards;
        console.log('botCards: ' + cards)
        
        let num1;
        let suit1;
        let num2;
        let suit2;
        
        if (cards[0].length == 3) {
            num1 = convertCardValue(cards[0].substring(0, 2));
            suit1 = cards[0].charAt(2);
        } else {
            num1 = convertCardValue(cards[0].charAt(0));
            suit1 = cards[0].charAt(1);
        }
        if (cards[1].length == 3) {
            num2 = convertCardValue(cards[1].substring(0, 2));
            suit2 = cards[1].charAt(2);
        } else {
            num2 = convertCardValue(cards[1].charAt(0));
            suit2 = cards[1].charAt(1);
        }

        // console.log("Card 1: " + num1 + suit1);
        // //console.log("Card 2: " + num2 + suit2);

        //console.log(recentBet);

        //pair
        if (num1 == num2) {
            //if they call we should just bet like 10 else 
            if (recentBet <= 10) {
                bet = 10;
            } else {
                bet = recentBet; 
            }
        }
        
        //2 of same suit
        else if (suit1 == suit2) {
            if (recentBet <= 5) {
                bet = 5;
            } else {
                bet = recentBet;
            }
        }
        
        //high card
        else if (num1 >= 13 || num2 >= 13 || (num1 > 10 && num2 > 10)) {
            if (recentBet <= 3) {
                bet = 3;
            } else {
                bet = recentBet;
            }
        } 
        else {
            //call here
            bet = recentBet;
        } 
    } else if (curPhase == 1) { //flop betting
        if (botHandVal == undefined) { //but this shouldn't happen ?
            bet = -1;
        } else if (botHandVal < 100000000 || called) {	
            bet = recentBet; 
        } else if (botHandVal < 200000000) {	
            bet = recentBet * 1.1;
        } else if (botHandVal < 300000000) {	
            bet = recentBet * 1.15;
        } else if (botHandVal < 400000000) {	
            bet = recentBet * 1.2;
        } else if (botHandVal < 500000000) {
            if (called && recentBet <= 5) {
                bet = 5
            } else {
                bet = recentBet * 1.25;
            }
        } else if (botHandVal < 600000000) {
            if (called && recentBet <= 6) {
                bet = 6
            } else {
                bet = recentBet * 1.4;
            }
        } else if (botHandVal < 700000000) {
            if (called && recentBet <= 7) {
                bet = 7
            } else {
                bet = recentBet * 2;
            }
        } else if (botHandVal < 800000000) {
            if (called && recentBet <= 8) {
                bet = 8
            }	
            else bet = recentBet * 2.5;
        } else if (botHandVal < 900000000) {
            if (called && recentBet <= 9) {
                bet = 9
            } else {
                bet = recentBet * 3;
            }
        }
    } else if (curPhase == 2) { //turn betting
        if (botHandVal == undefined) { //but this shouldn't happen ?
            bet = recentBet + 1;
        } else if (called && botHandVal < 400000000) {
            bet = recentBet;
        } else if (botHandVal < 200000000) {
            bet = -1;
        } else if (botHandVal < 200000000) {
            bet = recentBet; //call 
        } else if (botHandVal < 300000000) {
            bet = recentBet * 1.1;
        } else if (botHandVal < 400000000) {
            bet = recentBet * 1.2;
        } else if (botHandVal < 500000000) {
            bet = recentBet * 1.25;
        } else if (botHandVal < 600000000) {
            if (called && recentBet <= 5) {
                bet = 5;
            } else {
                bet = recentBet * 1.4;
            }
        } else if (botHandVal < 700000000) {
            if (called && recentBet <= 6) {
                bet = 6;
            } else {
                bet = recentBet * 1.8;
            }
        } else if (botHandVal < 800000000) {
            if (called && recentBet <= 7) {
                bet = 7;
            } else {
                bet = recentBet * 2;
            }
        } else if (botHandVal < 900000000) {
            if (called && recentBet <= 8) {
                bet = 8;
            } else {
                bet = recentBet * 2.5;
            }
        }
    } else if (curPhase == 3) { //river betting
        if (botHandVal == undefined) { //but this shouldn't happen ?
            bet = recentBet;
        } else if (called && botHandVal < 500000000) {
            bet = recentBet;
        } else if (botHandVal < 200000000) {
            bet = -1;
        } else if (botHandVal < 300000000) {
            bet = recentBet;
        } else if (botHandVal < 400000000) {
            bet = recentBet * 1.15;
        } else if (botHandVal < 500000000) {
            bet = recentBet * 1.25;
        } else if (botHandVal < 600000000) {
            bet = recentBet * 1.4;
        } else if (botHandVal < 700000000) {
            if (called && recentBet <= 5) {
                bet = 5;
            } else {
                bet = recentBet * 1.7;
            }
        } else if (botHandVal < 800000000) {
            if (called && recentBet <= 7) {
                bet = 7;
            } else {
                bet = recentBet * 1.85;
            }
        } else if (botHandVal < 900000000) {
            if (called && recentBet <= 9) {
                bet = 9;
            } else {
                bet = recentBet * 2;
            }
        }
    } 
    if (bet > playerList[botId].balance) {
        return playerList[botId].balance;
    }	
    return Math.round(bet);	
    	
}

io.on("connection", function (socket) {
    socket.on("startSession", function (data) {
        //console.log("starting session");

        if (data.sessionId == null || !playerArray.includes(data.sessionId)) {
            socket.realId = socket.id;
            socketList[socket.id] = socket;

            createPlayer(socket);
            //console.log("new session");
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
        //console.log("room entered");
        if (createGame(socket, data.gameId) == -1) {
            joinGame(socket, data.gameId);
        }
    });

    socket.on("createGame", function (data) {
        //console.log("create game");
        createGame(socket, data.gameId);
    });

    socket.on("joinGame", function (data) {
        //console.log("join game");
        joinGame(socket, data.gameId);
    });

    socket.on("setName", function (data) {
        if (gameArray.includes(data.gameId)) {
            //console.log("setting name: " + data.name);
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
        //console.log("called play with bot");	
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
        if (data.bet > 0 && gameList[socket.gameId].recentBet > data.bet) {
            socket.emit("addToChat", "<b> insufficent bet </b>")
        }
        else if (socket.realId == playerArray[gameList[socket.gameId].playerTurn]) {
            updatePlayerBetData(socket.realId, data.bet);
            //set call behavior
            if (data.bet === -2) {
                data.bet = gameList[socket.gameId].recentBet
            }
            //set normal behavior
            if (data.bet !== -1) {
                let betDiff = data.bet - playerList[socket.realId].bet;
                playerList[socket.realId].bet = data.bet;
                playerList[socket.realId].balance -= betDiff;
    
                gameList[data.gameId].pot += betDiff;
                io.to(data.gameId).emit('setPot', {
                    pot: gameList[data.gameId].pot
                })
    
                io.to(data.gameId).emit('setBalance', {
                    balance:playerList[socket.realId].balance,
                    playerId: socket.realId
                });
            }

            //fold
            if (data.bet == -1) {
                playerList[socket.realId].bet = data.bet;
                message = playerList[socket.realId].name + " folded";
                playerList[socket.realId].inhand = false;
                gameList[socket.gameId].called = false;
            }
            //call
            else if (data.bet == gameList[socket.gameId].recentBet) {
                message = playerList[socket.realId].name + " called";
                gameList[socket.gameId].called = true;
            }
            //raise
            else {
                gameList[socket.gameId].recentBet = data.bet;
                message = playerList[socket.realId].name + " bet: " + data.bet;
                gameList[socket.gameId].called = false;
            }
            playerDataList[socket.realId].setTurnEndTime();
            updatePlayerTimeToBet(socket.realId);
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
