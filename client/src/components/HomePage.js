import React, {useState} from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import * as ROUTES from '../constants/routes'

import socketClient  from "socket.io-client";
const SERVER = "http://127.0.0.1:8080";
const socket = socketClient(SERVER, { transports : ['websocket', 'polling', 'flashsocket'] });


const useStyles = makeStyles((theme) => ({
paper: {
    marginTop: theme.spacing(8),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
},
avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
},
form: {
    width: '100%', // Fix IE 11 issue.
    marginTop: theme.spacing(1),
},
submit: {
    margin: theme.spacing(3, 0, 2),
},
}));

const HomePage = () => {

    const classes = useStyles();

    const handleJoinGame = () => {

    }

    return (
        <Container component="main" maxWidth="xs">
        <CssBaseline />
        <div className={classes.paper}>
            <Avatar className={classes.avatar}>
            <MonetizationOnIcon />
            </Avatar>
            <Typography component="h1" variant="h4">
            Poker
            </Typography>
            <form className={classes.form} onSubmit={handleJoinGame}>
            <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label="Game ID"
                name="gameId"
                autoFocus
            />
            <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
            >
                Join Game
            </Button>
            </form>
        </div>
        </Container>
    );
}

export default HomePage