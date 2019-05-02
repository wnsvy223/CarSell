var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var moment = require('moment');


router.get('/', function(req, res, next) {

    mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
            var query = 'select board.*, users.userProfile from board inner join users on users.userId=board.userId_w order by board_num desc';
            // 게시판 테이블 모든 데이터 + 유저테이블의 글 작성자 프로필사진 inner join 조회및 내림차순 정렬
            connection.query(query,function (err, rows, fields){
                if(err){
                    console.log('query error'+err);
                }else{               
                    console.log('전체게시물 : ' + rows.length);
                    var renderParam ={
                        email : req.session.email, 
                        profileImage : req.session.userProfile, 
                        userId : req.session.userId, 
                        rows : rows, 
                        moment : moment,
                        totalPage : rows.length / 10,
                        list : 10,
                        currentPageIdx : 0
                    }
                    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'); 
                    // 캐시저장X -> 뒤로가기 누르면 조회수값 갱신
                    res.render('board-free', renderParam);
                    connection.release();
                }
            });
        }
    });
}); 


router.get('/page/:idx', function(req, res, next){
  
    mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
            var queryAll = 'select board.*, users.userProfile from board inner join users on users.userId=board.userId_w order by board_num asc';
            connection.query(queryAll, function(err, totalRows, fields){
                var totalList = totalRows.length;        // 전체 게시물 수
                var currentPage = parseInt(req.params.idx)  * 10;   // 페이지번호 * 10 = 게시물 인덱스값  
                if(currentPage < 0 || currentPage > totalList){
                    res.send('<script type="text/javascript">alert("더 이상 글이 없습니다.");</script>');
                }else{ 
                    var query = 'select board.*, users.userProfile from board inner join users on users.userId=board.userId_w order by board_num desc limit ?,?';
                    // 페이지 번호가 바뀜에 따라 mysql limit + offset으로 10개 단위로 나눠서 조회
                    connection.query(query, [currentPage, 10], function (err, rows, fields){
                        if(err){
                            console.log('query error'+err);
                        }else{
                            console.log('페이지:' + currentPage + '페이지 인덱스:' + parseInt(req.params.idx));
                            if(rows.length < 10){ // 페이지에 남은 게시물이 10개 미만일 경우
                                var renderParam ={
                                    email : req.session.email, 
                                    profileImage : req.session.userProfile, 
                                    userId : req.session.userId, 
                                    rows : rows, 
                                    moment : moment,
                                    totalPage:  parseInt(totalList / 10) + 1, // 10개 미만인 페이지의 경우 소수점이 되므로 + 1
                                    list : rows.length, // 조회할 게시물 리스트 개수 = 남은 리스트 개수
                                    currentPageIdx : parseInt(req.params.idx)
                                }
                                res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                                res.render('board-free', renderParam);
                                connection.release();
                            }else{
                                var renderParam ={
                                    email : req.session.email, 
                                    profileImage : req.session.userProfile, 
                                    userId : req.session.userId, 
                                    rows : rows, 
                                    moment : moment,
                                    totalPage: parseInt(totalList / 10) + 1,
                                    list : 10,
                                    currentPageIdx : parseInt(req.params.idx)
                                }
                                res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                                res.render('board-free', renderParam);
                                connection.release();
                            }
                        }
                    });
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
                
                    var board_idx = rows[0].board_num; // 쿼리된 번호에 해당하는 게시글의 조회수 +1 해서 업데이트
                    var updateViewsQuery = 'update board set board.readCount=board.readCount + 1 where board.board_num=?';
                    connection.query(updateViewsQuery,[board_idx], function(err, rows, fields){
                        if(err){
                            console.log('quey error'+err);
                        }else{
                            res.render('board-free-detail', renderParam);
                            connection.release(); 
                        }
                    });
                                     
                }
            });
        }
    });     
});


module.exports = router;
