var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var mkdirp = require('mkdirp'); // 디렉토리 관리 모듈
var mime = require('mime');
var fs = require('fs');
var multer = require('multer');  // 파일 전송용 multer 모듈
var storage = multer.diskStorage({
  destination: function (req, file, callback) {
      var destination = 'userProfiles';
      mkdirp.sync(destination); // 디렉토리 생성
      callback(null,destination); 
  },
  filename: function (req, file, callback) {
      callback(null, file.originalname + '-' + Date.now() + '.' + mime.getExtension(file.mimetype)); // 파일 생성
  }
});
var upload = multer({ storage: storage })


router.get('/', function(req, res, next) {
  if(!req.session.email){
    res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
  }else{
    res.render('profile',{email : req.session.email, profileImage : req.session.userProfile, userId: req.session.userId});
  }
});


router.post('/edit', function(req, res, next){
  if(!req.session.email){
    res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
  }else{
    console.log("세션값" + JSON.stringify(req.session));
    console.log("입력값" + JSON.stringify(req.body));
    if(req.body.userId ===''){
      res.send('<script type="text/javascript">alert("내용을 입력해 주세요");</script>');
    }else if(req.body.userId !==''){
      mysqlDB.getConnection(function(err, connection){
        if(err){
          console.log('connection pool error'+err);
        }else{
          connection.query('update users set userId=? where email=?', [req.body.userId, req.session.email], function (err, rows, fields) {
            if(!err){
              req.session.userId = req.body.userId; // 새 아이디값을 세션정보에 넣어줌. 
              req.session.save(function(){  //세션값이 변경되면 save함수 호출해서 변경값을 세션테이블에 저장.
                res.redirect('/profile'); // 페이지 갱신
              });
              connection.release();
            }else{
              res.render('Insert Error : ' + err);
            }    
          }); 
        }
      });    
    }
  }
});

router.post('/edit_img', upload.single('edit_img'), function(req, res, next){
  if(!req.session.email){
    res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
  }else{
  if(req.file === undefined){
    res.send('<script type="text/javascript">alert("이미지파일을 첨부해 주세요");</script>');
  }else{
      mysqlDB.getConnection(function(err, connection){
        if(err){
          console.log('connection pool error'+err);
        }else{
          var path = '/' + req.file.path;
          connection.query('update users set userProfile=? where email=?', [path, req.session.email], function (err, rows, fields) {
          if(!err){
            var sessionPath = req.session.userProfile;
            var oldPath = sessionPath.substring(1);
            removeFile(oldPath); // 기존 이미지를 삭제.
            req.session.userProfile = path; // 새 이미지 파일 경로를 세션정보에 넣어줌. 
            req.session.save(function(){  //세션값이 변경되면 save함수 호출해서 변경값을 세션테이블에 저장.
              res.redirect('/profile'); // 페이지 갱신
            });
            connection.release();
          }else{
            res.render('Insert Error : ' + err);
          }    
          }); 
        }
      }); 
    }
  }
});

// 파일 확인 및 삭제 함수
function removeFile(oldFilePath){
  fs.exists(oldFilePath, function(exists){
    console.log("세션파일" + exists ? "있음!" : "없음!");
    if(exists){
      fs.unlink(oldFilePath, function(err){
        if(err) throw err;
        console.log("파일삭제성공");
      });
    }
  });
}

module.exports = router;
