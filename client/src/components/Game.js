import React, {useEffect, useState} from 'react';
import socketClient  from "socket.io-client";

import Grid from '@material-ui/core/Grid'
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Button from '@material-ui/core/Button';

import H2 from '../images/cards/2H.svg'



const SERVER = "http://127.0.0.1:8080";
const socket = socketClient(SERVER, { transports : ['websocket', 'polling', 'flashsocket'] });

const Game = () => {
    const [playerId, setPlayerId] = useState(undefined) 
    const [playerTurn, setPlayerTurn] = useState(undefined)
    const [isGameStarted, setIsGameStarted] = useState(false)
    

    useEffect(() => {
        socket.on('connection', () => {
            console.log('connected');
        });
        socket.on('acquireUID', (data) => {
            setPlayerId(data.uid);
        }); 
        socket.on('startGameAck')
    }, [])

    const handleStartGame = () => {
        socket.emit('startGameSyn');
    }

    const handleBet = (bet) => {
        console.log(bet)

        socket.emit('bet', {})
        socket.emit('endTurn')
    }

    const handleCheck = () => {

    }

    const handleFold = () => {

    }

    return (
        <Grid container direction={'column'} style={{maxWidth: '1000px', margin: 'auto', width: '100%'}}>
            <Grid item xs={12}>
                {!isGameStarted &&
                    <Button>
                        Start Game
                    </Button>
                }
            </Grid>
            <Grid item xs={12}>
                <Grid container direction={'row'}>
                    <Grid item xs={3}>
                        <img src={H2}>
                        </img>
                    </Grid>
                    <Grid item xs={3}>
                        <img src={H2}>
                        </img>
                    </Grid>
                    
                </Grid>
            </Grid>
            <Grid item xs={12}>
                <ButtonGroup variant="contained" color="primary">
                    <Button onClick={handleCheck()}>
                        Check
                    </Button>
                    <Button onClick={() => handleBet(10)}>
                        Call
                    </Button>
                    <Button onClick={() => handleBet(20)}>
                        Raise
                    </Button>
                </ButtonGroup>
            </Grid>
        </Grid>
    )
}

export default Game;