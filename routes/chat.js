var express = require('express');
var mysqlDB = require('../mysqlDB');
var sessionEmail = ''; // 전역변수로 잡고 채팅화면으로 라우팅될때 세션에 저장된 email 받아옴.

module.exports = function(io){
  var router = express.Router();
  router.get('/', function(req, res, next) {
    if(req.session.email){
      sessionEmail = req.session.email;
      var email = req.session.email;
      var userId = req.session.userId;
      var sessionProfile = req.session.userProfile;
      var userProfile = sessionProfile.replace(/\\/g,'/'); // 경로기호 escape 문자열 replace로 바꿔서 보냄
      var params = {
        email : email,
        userId : userId,
        userProfile : userProfile,
      }     
      res.render('chat', params);
    }else{
      console.log("세션이 끊어짐");    
      res.render('index');
    }
  });

  io.on('connection',function(socket){
    var cookies = socket.handshake.headers.cookie;; // 접속유저의 아이피 주소
    console.log('- 클라이언트가 접속되었습니다.\n  socket.id: %s', socket.id);
    console.log(' 소켓 SID : ' + cookies);
    
    // 소켓 연결되면 연결 요청한 사용자의 socket id를 DB에 저장
    mysqlDB.getConnection(function(err, connection){
      if(err){
          console.log('connection pool error'+err);
      }else{
        var query = 'update users set users.socketId=? where users.email=?';    
        connection.query(query, [socket.id, sessionEmail], function(err, rows, fields){
            if(err){
              console.log('quey error'+err);
            }else{      
              console.log('소켓아이디 DB 입력' + socket.id + sessionEmail);;
              connection.release();
            }
        });   
      }
    }); 

    // 클라이언트 접속이 종료될 경우 실행할 이벤트핸들러 등록
      socket.on('disconnect', function() {
        console.log('- 클라이언트 접속이 종료되었습니다.\n  socket.id: %s', socket.id);
    });

    // 클라이언트의 'chat message' 이벤트 수신시 실행할 이벤트핸들러 등록
    socket.on('chat message', function(data) {
      console.log('- 메시지: %s > %s', socket.id, data);

      // 접속된 모든 클라이언트에게 메시지 전달
      //io.emit('chat message', data);

      // 메시지를 전송한 클라이언트를 제외한 모든 클라이언트에게 메시지 전달
      socket.broadcast.emit('chat message', data);

      // 메시지를 전송한 클라이언트에게 메시지 전달
      socket.emit('chat sended', data);

      // 특정 클라이언트에게만 메시지 전달
      //io.to(userSocketID).emit('chat message', data);
    });

  });

  return router;
}