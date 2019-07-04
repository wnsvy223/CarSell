var express = require('express');
var router = express.Router();
var RTCMultiConnectionServer = require('rtcmulticonnection-server');
var config = {
    "socketURL": "/stream",
    "dirPath": "",
    "homePage": "/",
    "socketMessageEvent": "RTCMultiConnection-Message",
    "socketCustomEvent": "RTCMultiConnection-Custom-Message",
    "port": 8443,
    "sslKey": "./keys/key.pem",
    "sslCert": "./keys/cert.pem",
    "enableLogs": false,
    "isUseHTTPs": true,
    "enableAdmin": false
};

module.exports = function(io){

    
    router.get('/', function(req, res, next) {
        if(req.session.email){
          res.render('stream'); 
        }else{   
          res.render('index');
        }
    });

    /*
    // Custom Socket.io Seerver connection
    io.on('connection', function(socket){
        RTCMultiConnectionServer.addSocket(socket, { config: config });

        const params = socket.handshake.query;

        if (!params.socketCustomEvent) {
            params.socketCustomEvent = 'custom-message';
        }

        socket.on(params.socketCustomEvent, function(message) {
            socket.broadcast.emit(params.socketCustomEvent, message);
        });

    });
    */
    
    return router;
}