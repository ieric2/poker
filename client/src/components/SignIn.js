import React, {useState} from 'react';
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth';
import firebase from 'firebase'
import { withFirebase } from './Firebase';

const uiConfig = {
    signInFlow: 'popup',
    signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    ],
    signInSuccessUrl: '/game'
}

const SignIn = (props) => {
    const [error, setError] = useState('')

    const handleSignIn = () => {

    }



    return (
        <div>
            <StyledFirebaseAuth uiConfig={uiConfig} firebaseAuth={firebase.auth()}/>
        </div>
            
    );
}

export default withFirebase(SignIn)