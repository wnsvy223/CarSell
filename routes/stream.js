var express = require('express');
var router = express.Router();


module.exports = function(io){

    router.get('/', function(req, res, next) {
        if(req.session.email){
          res.render('stream-main');  
        }else{
          console.log("세션이 끊어짐");    
          res.render('index');
        }
    });

    
    router.get('/stream_start', function(req, res, next) {
        if(req.session.email){
          res.render('stream');  
        }else{
          console.log("세션이 끊어짐");    
          res.render('index');
        }
    });

    
    router.get('/visualize', function(req, res, next) {
        if(req.session.email){
          res.render('stream-visualize');  
        }else{
          console.log("세션이 끊어짐");    
          res.render('index');
        }
    });
      

    io.on('connection',function(socket){
        socket.on('stream',function(image){
          socket.broadcast.emit('stream', image);  
        });
        socket.on('voice',function(voice){
          socket.broadcast.emit('voice', voice);  
      });
    });

    return router;
}