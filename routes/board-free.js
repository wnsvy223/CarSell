var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var moment = require('moment');

router.get('/', function(req, res, next) {
    var date_now = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
    mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
            var query = 'select board.*, users.userProfile from board inner join users on users.userId=board.userId_w order by board_num asc';
            // 게시판 테이블 모든 데이터 + 유저테이블의 글 작성자 프로필사진 inner join 조회
            connection.query(query,function (err, rows, fields){
                if(err){
                    console.log('query error'+err);
                }else{
                    var renderParam ={
                        email : req.session.email, 
                        profileImage : req.session.userProfile, 
                        userId: req.session.userId, 
                        rows: rows, 
                        moment: moment
                    }
                    res.render('board-free', renderParam);
                    connection.release();
                    //console.log('조회값'+ JSON.stringify(rows));
                }
            });
        }
    });
}); 


router.get('/write', function(req, res, next){  
    var renderParam = {
        email : req.session.email, 
        profileImage : req.session.userProfile, 
        userId: req.session.userId
    };
    res.render('board-free-write', renderParam);
});


router.post('/write/commit',function(req, res, next){
    if(req.body.title == '' || req.body.content == ''){
        res.send('<script type="text/javascript">alert("내용을 입력해 주세요");</script>');
    }else{
        var date_now = moment().format('YYYY-MM-DD HH:mm:ss:SSS'); // 현재시간값 타임스탬프
        var param = {
            title: req.body.title,
            userId_w: req.session.userId,
            timeStamp : date_now,
            readCount : 0,
            content : req.body.content,
            //profileImage : '/'+req.file.path // multer모듈로 부터 생성된 프로필 이미지파일의 경로
        };
        
        var query = 'insert into board (board_title, userId_w, timeStamp, readCount, content) values(?,?,?,?,?)';
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                connection.query(query, [param.title, param.userId_w, param.timeStamp, param.readCount, param.content, param.userProfile_w], function(err, rows, fields){
                    if(err){
                        console.log('quey error'+err);
                    }else{
                        console.log("글작성완료");
                        res.redirect('/board-free');
                        connection.release();
                    }
                });
            }
        });
    } 
});

router.get('/detail?:data_board_num', function(req, res, next){
    // 뷰에서 href를 통해 넘겨준 시멘틱URL 값에 해당 게시물의 번호가 날아옴.
    console.log('시멘틱URL 인덱스 : ' + req.query.index);

    mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
            var query = 'select * from board where board_num=?';
            connection.query(query, [req.query.index], function(err, rows, fields){
                if(err){
                    console.log('quey error'+err);
                }else{                   
                    console.log("본문보기" + JSON.stringify(rows));
                    var renderParam = {
                        email : req.session.email, 
                        profileImage : req.session.userProfile, 
                        userId : req.session.userId,
                        userProfile_w : req.query.userProfile_w, // 작성자 프로필사진
                        board_title : rows[0].board_title,
                        userId_w : rows[0].userId_w,
                        timeStamp : rows[0].timeStamp,
                        content : rows[0].content,
                        rows: rows // 본문 조회값
                    };
                    res.render('board-free-detail', renderParam);
                    connection.release();
                }
            });
        }
    });     
});


module.exports = router;
