var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var mkdirp = require('mkdirp'); // 디렉토리 관리 모듈
var mime = require('mime');
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
var bcrypt = require('bcrypt'); // 암호화 모듈

/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.session.email){
    console.log("세션이 유지중" + req.session.email +' / ' +req.session.userProfile);
    res.render('main',{email : req.session.email, profileImage : req.session.userProfile , userId : req.session.userId});
  }else{
    console.log("세션이 끊어짐");
    res.render('index', { title: 'Express' });
  }
});

// 로그아웃
router.get('/logout', function(req, res, next){
  req.session.destroy(); // 세션삭제
  res.clearCookie('sid'); // 쿠키삭제
  res.render('index', { title: 'Express' }); // index 페이지로 이동
});

// 로그인
router.post('/login', function(req, res, next) {
  
  var body = req.body;
  var param = {
    email: body.email,
    password : body.password
  };

  const invalidPassword = '비밀번호가 틀렸습니다.';
  const unRegisterUser = '미가입 유저 입니다.';
  const noInput = '로그인 정보를 입력하세요.';

  if(req.body.email =='' || req,body.password == ''){
    res.render('index',{noInput : noInput});
  }else{
    mysqlDB.getConnection(function(err, connection){
        if(err){
          console.log('connection pool error'+err);
        }else{
          connection.query('select * from users where email=?', [param.email], function (err, rows, fields) {
          if(err){
              console.log('Login error'+err);
              res.render('Login Error : ' + err);
          }else if(rows[0] === undefined ){
              console.log('미가입 유저 입니다');
              res.render('index',{unRegisterUser : unRegisterUser});
          }else{
              var isCompareEncryptPW = bcrypt.compareSync(param.password, rows[0].password);
              if(!isCompareEncryptPW){
                console.log('비밀번호가 틀렸습니다.');       
                res.render('index',{invalidPassword : invalidPassword});
              }else{
                // 렌더링 될 메인페이지로 Mysql로 부터 받아온 email, profileImage, userId 넘겨줌           
                // 세션객체가 존재하지 않으면 생성하면서 메인페이지로 이동
                if(req.session.email){
                  console.log('세션이 이미 존재합니다.');
                }else{
                  req.session.email = req.body.email;
                  req.session.userProfile = rows[0].userProfile;
                  req.session.userId = rows[0].userId;  // 세션 객체에 저장할 데이터들
                  connection.release();
                  console.log('세션 생성 + 저장 완료 : ' + req.session.email + '----' + req.session.userProfile + '----' + req.session.userId );
                }
                res.render('main',{email : param.email, profileImage : rows[0].userProfile, userId: rows[0].userId});
                console.log('로그인 성공');
              }
            }
        }); 
      }
    });
  }
});

// 회원가입
router.post('/register', upload.single('file'),function(req,res,next){
  var body = req.body;

  if(req.body.userId == '' || req.body.email == '' || req.body.password == '' || req.file == undefined){
    res.send('<script type="text/javascript">alert("가입정보를 입력해 주세요");</script>');
  }else{
    var param = {
      userId: body.userId,
      email: body.email,
      password : body.password,
      profileImage : '/'+req.file.path // multer모듈로 부터 생성된 프로필 이미지파일의 경로
    };

    mysqlDB.getConnection(function(err, connection){
        if(err){
          console.log('connection pool error'+err);
        }else{
          var encoded_password = bcrypt.hashSync(param.password, 10); // 암호화된 비밀번호
          connection.query('insert into users values(?,?,?,?)', [param.userId,param.email, encoded_password, param.profileImage], function (err, rows, fields) {
            if (!err) {
              console.log('유저 가입 정보',param);
              console.log('업로드 파일 정보',req.file);
              req.session.email = param.email;
              req.session.userProfile = param.profileImage;
              req.session.userId = param.userId;  // 세션 객체에 저장할 데이터들
              res.render('main',{userId : param.userId, profileImage : param.profileImage});
              connection.release();
            } else {
              res.render('Insert Error : ' + err);
            }    
          }); 

        }
      });
  }
});

module.exports = router;