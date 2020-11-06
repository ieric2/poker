import React, {useEffect, useState} from 'react';
import socketClient  from "socket.io-client";

const SERVER = "http://127.0.0.1:8080";
const socket = socketClient(SERVER, { transports : ['websocket', 'polling', 'flashsocket'] });

const App = () => {
    useEffect(() => {
        socket.on('connection', () => {
            console.log(`I'm connected with the back-end`);
        }); 
    }, [])

    return (
        <div>
            hi
        </div>
    )
}

export default App;