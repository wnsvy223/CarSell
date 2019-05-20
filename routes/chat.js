var express = require('express');
var mysqlDB = require('../mysqlDB');
var roomname = ''; // 채팅화면으로 라우팅될때 쿼리스트링으로부터 받아 올 roomname 전역변수.
var sessionEmail = ''; // 채팅화면으로 라우팅될때 세션에 저장된 email 받아 올 전역변수.
var sessionUserId = ''; // 채팅화면으로 라우팅될때 세션에 저장된 userId 받아 올 전역변수.
var moment = require('moment');

module.exports = function(io){
  var router = express.Router();
  router.get('/', function(req, res, next) {
    if(req.session.email){
      roomname = req.query.room; // 게시물 번호를 방이름으로
      sessionEmail = req.session.email;
      sessionUserId = req.session.userId;
      var sessionProfile = req.session.userProfile;
      var userProfile = sessionProfile.replace(/\\/g,'/'); // 경로기호 escape 문자열 replace로 바꿔서 보냄
     
      mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
          var query = 'SELECT chat_content.*,(select users.userProfile as thumnail from users where users.userId = chat_content.userId) thumnail from chat_content inner join users on users.userId = chat_content.userId where roomName=?';    
          connection.query(query, [roomname], function(err, rows, fields){
              if(err){
                console.log('quey error'+err);
              }else{    
                var params = {
                  sessionEmail : sessionEmail,
                  sessionUserId : sessionUserId,
                  userProfile : userProfile,
                  rows : rows
                }    
                console.log('대화내용 : ' + JSON.stringify(params.rows));
                res.render('chat', params);      
                connection.release();
              }
          });   
        }
      });    
    }else{
      console.log("세션이 끊어짐");    
      res.render('index');
    }
  });

  io.on('connection',function(socket){
    var room = roomname;  // 라우터로부터 받아온 방이름(게시물 번호)
    socket.join(room); // 방 참가
    //var cookies = socket.handshake.headers.cookie;; // 접속유저의 소켓 세션 아이디
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

     // 소켓 연결되면 chat-list 테이블에 정보 저장
    getVisits(function(err, rows){
      if(!err){
        console.log('방문자 아이디 : ' + rows[0].userId_w);
        mysqlDB.getConnection(function(err, connection){
          if(err){
              console.log('connection pool error'+err);
          }else{
            var now = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
            // 소켓 연결시 해당 번호로 채팅방이 존재하지 않을 경우만 테이블에 추가
            var query = 'insert into chat_list (owner, visit, roomName, timeStamp_chat) select ?,?,?,? from dual where not exists (select roomName from chat_list where roomName=?)';       
            connection.query(query, [sessionUserId, rows[0].userId_w, roomname, now, roomname], function(err, rows, fields){
                if(err){
                  console.log('quey error'+err);
                }else{      
                  connection.release();
                }
            });   
          }
        }); 
      }
    });

    // 클라이언트 접속이 종료될 경우 실행할 이벤트핸들러 등록
      socket.on('disconnect', function() {
        socket.leave(room); // 방 나감
        //exitRoom(room); // DB 대화 기록 삭제
        console.log('- 클라이언트 접속이 종료되었습니다.\n  socket.id: %s', socket.id);
    });

    // 클라이언트의 'chat message' 이벤트 수신시 실행할 이벤트핸들러 등록
      socket.on('chat message', function(data) {
        console.log('- 메시지: %s > %s', socket.id, data);

        var now = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
        socket.emit('chat sended', data);; // 내 메시지
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
                  saveMessage(params.userId,data,room,now);
                  connection.release();
                }
            });   
          }
        });          
    });
  });

  // 대화목록 라우터
  router.get('/list',function(req, res, next){ 
    if(!req.session.email){
      res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
    }else{   
      mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
          var query = 'select chat_list.*,(select users.userProfile as ownerProfile from users where users.userId = chat_list.visit) ownerProfile from chat_list inner join users on users.userId = chat_list.owner where owner=? or visit=? order by chat_list.timeStamp_chat desc';
          // 로그인한 유저가 참여한 대화목록만 조회        
          connection.query(query,[req.session.userId, req.session.userId], function(err, rows, fields){
              if(err){
                console.log('quey error'+err);
              }else{      
                var params = {
                  email : req.session.email, 
                  profileImage : req.session.userProfile, 
                  userId : req.session.userId,
                  rows : rows,
                  moment : moment
                };                
                res.render('chat-list', params);
                connection.release();
              }
          });   
        }
      });
      
    }    
  });

  return router;
}

function saveMessage(userId, message, roomName, timeStamp_chat){
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'insert into chat_content (userId, message, roomName, timeStamp_chat) values (?,?,?,?)';   // 소켓아이디로 부터 프로필사진 url 조회 
      connection.query(query, [userId, message, roomName, timeStamp_chat], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{       
            connection.release();
          }
      });   
    }
  });       
}

// 대화상대 조회
function getVisits(callback){
    mysqlDB.getConnection(function(err, connection){
      if(err){
          console.log('connection pool error'+err);
      }else{
        var query = 'select userId_w from board where board.board_num = ?'; 
        connection.query(query, [roomname], function(err, rows, fields){
            if(err){
              console.log('quey error'+err);
            }else{             
              console.log('아이디 : ' + JSON.stringify(rows));  
              return callback(err, rows);        
            }
            connection.release();
        });   
      }
  }); 
}

// 대화방에 상대가 나갔을 경우 대화 기록이 필요 없으므로 DB에서 삭제하기 위한 함수
function exitRoom(roomName){  
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'delete from chat_list where roomName=?'; 
      connection.query(query, [roomName], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{                        
            console.log('채팅방 기록 삭제'+ JSON.stringify(rows));
          }
          connection.release();
      });   
    }
  }); 
}