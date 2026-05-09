const functions = require('firebase-functions');

const authenticated = (context, role) => {
    if (context && context.auth) {
        if (!role) {
            return context.auth.uid !== null;
        }
        return context.auth.token.role === role;
    }
    return false;
};



const handleResponse = (code, message) => {
    if (code === 'failed-precondition') {
        message = `Missing ${message}`;
    }
    functions.logger.log({code: code, value: message});
    throw new functions.https.HttpsError(code, message);
};


module.exports = {
    authenticated: authenticated,
    handleResponse: handleResponse,
}