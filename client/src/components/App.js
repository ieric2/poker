import React, {useState, useEffect} from 'react';
import {BrowserRouter, Route} from 'react-router-dom'
import SignIn from './SignIn'
import HomePage from './HomePage'
import Game from './Game'
import LandingPage from './LandingPage'
import Copyright from './Copyright'
import Box from '@material-ui/core/Box'



import * as ROUTES from '../constants/routes';
import { withFirebase } from './Firebase';
import {AuthUserContext, withAuthorization, withAuthentication} from './Session'

const App = (props) => (
    <BrowserRouter>
        <Route exact path={ROUTES.LANDING} component={LandingPage}/>
        <Route path="/home" component={HomePage} />
        <Route path='/game' component={Game}/>
        <Route path='/login' component={SignIn}/>
        <Box mt={8}>
            <Copyright />
        </Box>    
    </BrowserRouter>
);

export default withAuthentication(App)
