var express = require('express');
var mysqlDB = require('../mysqlDB');
var sessionEmail = ''; // 채팅화면으로 라우팅될때 세션에 저장된 email 받아 올 전역변수.
var roomname = ''; // 채팅화면으로 라우팅될때 쿼리스트링으로부터 받아 올 roomname 전역변수.

module.exports = function(io){
  var router = express.Router();
  router.get('/', function(req, res, next) {
    if(req.session.email){
      roomname = req.query.room; // 게시물 번호를 방이름으로
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
    var room = roomname;  // 라우터로부터 받아온 방이름(게시물 번호)
    socket.join(room); // 방 참가
    var cookies = socket.handshake.headers.cookie;; // 접속유저의 소켓 세션 아이디
    console.log('- 클라이언트가 접속되었습니다.\n  socket.id: %s', socket.id);
    //console.log(' 소켓 SID : ' + cookies);
    console.log('방이름(소켓) : ' + room);
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
              console.log('소켓아이디 DB 입력' + socket.id +' / ' +sessionEmail);;
              connection.release();
            }
        });   
      }
    }); 

    // 클라이언트 접속이 종료될 경우 실행할 이벤트핸들러 등록
      socket.on('disconnect', function() {
        socket.leave(room); // 방 나감
        console.log('- 클라이언트 접속이 종료되었습니다.\n  socket.id: %s', socket.id);
    });

    // 클라이언트의 'chat message' 이벤트 수신시 실행할 이벤트핸들러 등록
      socket.on('chat message', function(data) {
        console.log('- 메시지: %s > %s', socket.id, data);

        mysqlDB.getConnection(function(err, connection){
          if(err){
              console.log('connection pool error'+err);
          }else{
            var query = 'select userProfile, userId from users where socketId=?';   // 소켓아이디로 부터 프로필사진 url 조회 
            connection.query(query, [socket.id], function(err, rows, fields){
                if(err){
                  console.log('quey error'+err);
                }else{       
                  var profileImg = rows[0].userProfile;
                  var userId = rows[0].userId;       
                  var params = {
                    profileImg : profileImg,
                    userId : userId
                  }     
                  socket.broadcast.to(room).emit('chat message', data, params); // 나를 제외한 룸 내의 모든 클라이언트에게 메시지
                  socket.emit('chat sended', data);; // 내 메시지
                  connection.release();
                }
            });   
          }
        }); 

       
    });

  });

  return router;
}