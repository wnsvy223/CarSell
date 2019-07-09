var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var roomname = ''; // 채팅화면으로 라우팅될때 쿼리스트링으로부터 받아 올 roomname 전역변수.
var sessionEmail = ''; // 채팅화면으로 라우팅될때 세션에 저장된 email 받아 올 전역변수.
var sessionUserId = ''; // 채팅화면으로 라우팅될때 세션에 저장된 userId 받아 올 전역변수.
var moment = require('moment');

module.exports = function(io){

  // 채팅 화면
  router.get('/', function(req, res, next) {
    if(req.session.email){
      roomname = req.query.room; 
      sessionEmail = req.session.email;
      sessionUserId = req.session.userId;
      var sessionProfile = req.session.userProfile;
      var userProfile = sessionProfile.replace(/\\/g,'/'); // 경로기호 escape 문자열 replace로 바꿔서 보냄
     
      mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
          var query = 'select chat_content.*,(select users.userProfile as thumnail from users where users.userId = chat_content.userId) thumnail from chat_content inner join users on users.userId = chat_content.userId where roomName=? order by timeStamp_chat';    
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
                //console.log('대화내용 : ' + JSON.stringify(params.rows));
                res.render('chat', params);        
              }         
              connection.release();
          });   
        }       
      });   
    }else{
      console.log("세션이 끊어짐");    
      res.render('index');
    }
  });

  // 채팅 대화목록
  router.get('/list',function(req, res, next){ 
    if(!req.session.email){
      res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
    }else{   
      mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
          var query ='select chat_list.*,(select users.userProfile from users where users.userId = chat_list.visit) visitProfile,(select users.userProfile from users where users.userId = chat_list.owner) ownerProfile,(select chat_content.message from chat_content where chat_content.roomName=chat_list.roomName and timeStamp_chat = (select MAX(timeStamp_chat) from chat_content where chat_content.roomName=chat_list.roomName)) lastMessage from chat_list left outer join users on users.userId = chat_list.owner where owner=? or visit=? order by chat_list.timeStamp_chat desc'
          // 로그인한 유저가 참여한 대화목록만 조회( left outer join으로 프로필사진과 해당 채팅방의 마지막 메시지값 조인)        
          connection.query(query, [req.session.userId, req.session.userId], function(err, rows, fields){
              if(err){
                console.log('quey error'+err);
              }else{      
                var subQuery = 'select * from chat_join_user where userId = ?';
                connection.query(subQuery, [req.session.userId], function(err, subRows, fields){
                    if(err){
                      console.log('quey error'+err);
                    }else{
                      var params = {
                        email : req.session.email, 
                        profileImage : req.session.userProfile, 
                        userId : req.session.userId,
                        rows : rows,
                        moment : moment,
                        subRows : subRows
                      };                
                      res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                      res.render('chat-list', params);
                      connection.release();                
                    }
                });

              }
          });   
        }
      });  
    }    
  });

  // 채팅방 나가기 
  router.get('/exit',function(req, res, next){
    if(!req.session.email){
      res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
    }else{
      mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
          var query = 'update chat_list set chat_list.roomStatus=? where chat_list.roomName=?';  
          var roomStatus = 'empty';
          connection.query(query, [roomStatus, req.query.room], function(err, rows, fields){
            if(err){
              console.log('quey error'+err);
            }else{      
              console.log('채팅방 상태값 : ' + req.query.room + '번 방은 ' + roomStatus);
              exitRoom(req.query.room, req.session.userId);      
              connection.release();
              res.redirect('/chat/list');
            }
          });     
        }
      });
    }
  });


  io.on('connection',function(socket){
    var room = roomname;  // 라우터로부터 받아온 방이름
    socket.join(room); // 방 참가
    //var cookies = socket.handshake.headers.cookie;; // 접속유저의 소켓 세션 아이디
    console.log('- 클라이언트가 접속되었습니다.\n  socket.id: %s', socket.id);
    //console.log(' 소켓 SID : ' + cookies);
    console.log('방이름(소켓) : ' + room);
    saveSocketId(socket.id, sessionEmail); // 소켓 연결되면 연결 요청한 사용자의 socket id를 DB에 저장

    // 클라이언트 접속이 종료될 경우 실행할 이벤트핸들러 등록
    socket.on('disconnect', function() {
      socket.leave(room); // 방 나감
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
                saveMessage(params.userId, data, room, now); // 채팅내용 DB저장
                getUserId(room); // 대화상대 아이디 조회
                connection.release();
              }
          });   
        }
      });            
    });
  })
  .on('error', function(execption){
    console.log('소켓통신오류 : ' + execption);
  });

  return router;
}

// 사용자의 socket id를 DB에 저장
function saveSocketId(socketId, sessionEmail){
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'update users set users.socketId=? where users.email=?';    
      connection.query(query, [socketId, sessionEmail], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{      
            console.log('소켓아이디 DB 입력' + socketId +' / ' +sessionEmail);;       
            connection.release();
          }
      });   
    }
  }); 
}

// 채팅방 대화내용 DB 저장
function saveMessage(userId, message, roomName, timeStamp_chat){
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'insert into chat_content (userId, message, roomName, timeStamp_chat) values (?,?,?,?)';
      connection.query(query, [userId, message, roomName, timeStamp_chat], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{       
            connection.release();
          }
      });   
    }
  });     

   // 소켓 연결시 채팅방 참가 유저 테이블 데이터 생성 ( 해당 방번호, 유저아이디를 AND연산으로 중복방지하여 생성)
   mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'insert into chat_join_user (userId, roomName) select ?,? from dual where not exists (select userId from chat_join_user where userId=? AND  roomName=?)';
      connection.query(query, [userId, roomName, userId, roomName], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{       
            connection.release();
          }
      });   
    }
  });  
}

//대화 상대 아이디 조회
function getUserId(roomname){
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'select userId_w from board where board.userId_w = ?'; 
      connection.query(query, [roomname], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{             
            console.log('아이디 : ' + JSON.stringify(rows[0].userId_w));  
            setChatList(rows[0].userId_w);
          }
          connection.release();
      });   
    }
  }); 
}

function setChatList(userId_w){
  // 소켓 연결시 채팅방 테이블 데이터 생성( 해당 번호로 채팅방이 존재하지 않을 경우만 테이블에 추가 )
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var now = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
      var roomStatus = 'exist';
      var query = 'insert into chat_list (owner, visit, roomName, timeStamp_chat, roomStatus) select ?,?,?,?,? from dual where not exists (select roomName from chat_list where roomName=?)'; 
      connection.query(query, [sessionUserId, userId_w, roomname, now, roomStatus, userId_w], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{      
            connection.release();
          }
      });   
    }
  }); 
  
  // 대화 상대도 채팅참가자 목록 테이블에 insert
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'insert into chat_join_user (userId, roomName) select ?,? from dual where not exists (select userId from chat_join_user where userId=? AND  roomName=?)';
      connection.query(query, [userId_w, roomname, userId_w, roomname], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{       
            connection.release();
          }
      });   
    }
  });  
  
  // 대화 재개 시 채팅방 상태값 exist로 변경
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'update chat_list set chat_list.roomStatus=? where chat_list.roomName=?';
      connection.query(query, ['exist', roomname], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{       
            connection.release();
          }
      });   
    }
  });
}

// 대화방에 상대가 나갔을 경우 대화 기록이 필요 없으므로 DB에서 삭제하기 위한 함수
function exitRoom(roomName, userId){  
  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      // 채팅목록과 채팅내용 테이블 2개 roomName으로 join해서 삭제.
      //var query = 'delete chat_list, chat_content from chat_list inner join chat_content on chat_list.roomName = chat_content.roomName where chat_list.roomName = ?'
      var query = 'delete from chat_content where chat_content.roomName = ?';
      connection.query(query, [roomName], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{                        
            console.log('채팅방 기록 삭제'+ JSON.stringify(roomName));
          }
          connection.release();
      });   
    }
  }); 

  mysqlDB.getConnection(function(err, connection){
    if(err){
        console.log('connection pool error'+err);
    }else{
      var query = 'delete from chat_join_user where chat_join_user.roomName = ? AND chat_join_user.userId=?';
      connection.query(query, [roomName, userId], function(err, rows, fields){
          if(err){
            console.log('quey error'+err);
          }else{                        
            console.log('채팅방 참가자 기록 삭제'+ JSON.stringify(userId));
          }
          connection.release();
      });   
    }
  }); 
}