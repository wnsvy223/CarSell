var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');
var moment = require('moment');

var documentNum = 0; //게시물 번호값 받을 변수 
var profileImage_w = ''; // 게시물 작성자 프로필사진
var pageNum = 0; // 게시물 포함된 페이지 번호    -> 3가지를 get detail 라우터를 통해 본문 진입시 받아옴. 
var now = moment().format('YYYY-MM-DD HH:mm:ss:SSS');


// 게시판 메인 페이지
router.get('/', function(req, res, next) {
    if(!req.session.email){
        res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
    }else{ 
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                var query = 'select board.*,users.userProfile,(select count(*) as reply_count from board_reply where board.board_num = board_reply.board_num) reply_count from board inner join users on users.userId = board.userId_w order by board.board_num desc';
                // 게시판 테이블 모든 데이터 + 유저테이블의 글 작성자 프로필사진 inner join 조회후 게시물당 댓글수 서브쿼리 별칭reply_count부여 및 내림차순 정렬
                connection.query(query,function (err, rows, fields){
                    if(err){
                        console.log('query error'+err);
                    }else{                
                        var renderParam ={
                            email : req.session.email, 
                            profileImage : req.session.userProfile, 
                            userId : req.session.userId, 
                            rows : rows, 
                            moment : moment,
                            totalPage : parseInt( rows.length / 10) + 1, 
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
    }
}); 

// 페이징 처리
router.get('/page/:idx', function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                pageNum = req.params.idx;
                var queryAll = 'select board.*,users.userProfile,(select count(*) as reply_count from board_reply where board.board_num = board_reply.board_num) reply_count from board inner join users on users.userId = board.userId_w order by board.board_num desc';
                connection.query(queryAll, function(err, totalRows, fields){
                    var totalList = totalRows.length;        // 전체 게시물 수
                    var currentPage = parseInt(pageNum)  * 10;   // 페이지번호 * 10 = 게시물 인덱스값  
                    if(currentPage < 0 || currentPage > totalList){
                        res.send('<script type="text/javascript">alert("더 이상 글이 없습니다.");</script>');
                    }else{ 
                        var query = 'select board.*,users.userProfile,(select count(*) as reply_count from board_reply where board.board_num = board_reply.board_num) reply_count from board inner join users on users.userId = board.userId_w order by board.board_num desc limit ?,?';
                        // 페이지 번호가 바뀜에 따라 mysql limit + offset으로 10개 단위로 나눠서 조회
                        connection.query(query, [currentPage, 10], function (err, rows, fields){
                            if(err){
                                console.log('query error'+err);
                            }else{
                                //console.log('페이지:' + currentPage + '페이지 인덱스:' + parseInt(req.params.idx));
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
    }
});

// 게시판 글쓰기 페이지
router.get('/write', function(req, res, next){  
    if(!req.session.email){
        res.render('index'); // 세션이 끊긴 상태면 로그인 페이지로
    }else{
        var renderParam = {
            email : req.session.email, 
            profileImage : req.session.userProfile, 
            userId: req.session.userId,
            func: 'write',
            documentNum : documentNum, // 게시물 번호
            pageNum : pageNum // 페이지 번호
        };
        res.render('board-free-write', renderParam);
    }  
});

// 게시판 글쓰기 요청 처리
router.post('/write/commit',function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        if(req.body.title == '' || req.body.content == ''){
            res.send('<script type="text/javascript">alert("내용을 입력해 주세요");</script>');
        }else{

            var param = {
                title: req.body.title,
                userId_w: req.session.userId,
                timeStamp : now,
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
    }   
});

//게시판 댓글쓰기 요청 처리
router.post('/write/reply', function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        if(req.body.content_reply == ''){
            res.send('<script type="text/javascript">alert("내용을 입력해 주세요");</script>');
        }else{
            var reply_param = {
                board_num: documentNum,
                userId_reply: req.session.userId,
                content : req.body.content_reply,
                timeStamp : now
            };
           
            var query = 'insert into board_reply (board_num, userId_reply, reply_content, timeStamp_reply) values(?,?,?,?)';
            mysqlDB.getConnection(function(err, connection){
                if(err){
                    console.log('connection pool error'+err);
                }else{
                    connection.query(query, [reply_param.board_num, reply_param.userId_reply, reply_param.content, reply_param.timeStamp], function(err, rows, fields){
                        if(err){
                            console.log('quey error'+err);
                        }else{
                            var url = '/board-free/detail?index=' + documentNum + '&userProfile_w=' + profileImage_w + '&pageNum=' + pageNum;
                            res.redirect(url);
                            connection.release();
                        }
                    });
                }
            });
        }
    }
});

// 게시판 본문 내용 보기 페이지
router.get('/detail?:data_board_num', function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        // 뷰에서 href를 통해 넘겨준 시멘틱URL 값에 해당 게시물의 번호 , 작성자 프로필url, 페이지 번호가 날아옴.
        // console.log('시멘틱URL 인덱스 : ' + req.query.index);
        documentNum = req.query.index;
        profileImage_w = req.query.userProfile_w;
        pageNum = req.query.pageNum;
        //console.log('페이지번호'+pageNum);
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                var query = 'select * from board where board.board_num=?';
            
                connection.query(query, [documentNum], function(err, rows, fields){
                    if(err){
                        console.log('quey error'+err);
                    }else{     
                        documentTitle = rows[0].board_title;
                        documentContent = rows[0].content;
                        var select_reply = 'select board_reply.*, (select users.userProfile as userProfile_reply from users where board_reply.userId_reply = users.userId) userProfile_reply from board_reply where board_reply.board_num=?'
                        connection.query(select_reply, [documentNum], function(err, subrows, fields){
                            if(err){
                                console.log('quey error'+err);
                            }else{
                                //console.log('댓글 조회값'+JSON.stringify(subrows));
                                var renderParam = {
                                    email : req.session.email, 
                                    profileImage : req.session.userProfile, 
                                    userId : req.session.userId,
                                    userProfile_w : req.query.userProfile_w, // 작성자 프로필사진
                                    board_title : rows[0].board_title,
                                    userId_w : rows[0].userId_w,
                                    timeStamp : rows[0].timeStamp,
                                    content : rows[0].content,
                                    moment: moment,
                                    rows: rows, // 본문 조회값
                                    reply: subrows, // 댓글 조회값
                                    replyLength : subrows.length, // 댓글 갯수
                                    pageNum : parseInt(pageNum)// 게시물 페이지 번호
                                };
                                var board_idx = rows[0].board_num; // 쿼리된 번호에 해당하는 게시글의 조회수 +1 해서 업데이트
                                //console.log('인덱스', + board_idx);
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
            }
        });    
    } 
});

// 게시글 삭제 
router.get('/delete?:index', function(req, res, next){

    var board_idx = req.query.index;
    var page_idx = req.query.pageNum; 
    mysqlDB.getConnection(function(err, connection){
        if(err){
            console.log('connection pool error'+err);
        }else{
            var query = 'delete from board where board_num=?';       
            connection.query(query, [board_idx], function(err, rows, fields){
                if(err){
                    console.log('quey error'+err);
                }else{     
                    var url = '/board-free/page/' + page_idx;
                    res.redirect(url);
                    connection.release(); 
                }
            });
        }
    });   
});


// 게시글 수정 페이지
router.get('/update?:index', function(req, res, next){  
    if(!req.session.email){
        res.render('index'); 
    }else{
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                var query = 'select board.board_title, board.content from board where board.board_num =?';    
                connection.query(query, [req.query.index], function(err, rows, fields){
                    if(err){
                        console.log('quey error'+err);
                    }else{         
                        var renderParam = {
                            email : req.session.email, 
                            profileImage : req.session.userProfile, 
                            userId: req.session.userId,
                            func: 'update',
                            documentNum : req.query.index, // 게시물 번호
                            pageNum : pageNum,  // 페이지 번호
                            title_update : rows[0].board_title,
                            content_update : rows[0].content
                        };
                        console.log('수정 : ' + JSON.stringify(renderParam));
                        res.render('board-free-write', renderParam);
                    }
                });   
                
            }
        });  
    }  
});

// 게시글 수정 요청
router.post('/update/commit', function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('connection pool error'+err);
            }else{
                var title_update = req.body.title_update;
                var content_update = req.body.content_update;
                var board_num_update = documentNum;
                
                var query = 'update board set board.board_title=?, board.content=? where board.board_num=?';    
                connection.query(query, [title_update, content_update, board_num_update], function(err, rows, fields){
                    if(err){
                        console.log('quey error'+err);
                    }else{     
                        console.log('수정내용 : ' + title_update + content_update + board_num_update);
                        var url = '/board-free/detail?index=' + documentNum + '&userProfile_w=' + profileImage_w + '&pageNum=' + pageNum;
                        res.redirect(url);
                        connection.release(); 
                        console.log('수정완료');
                    }
                });   
                
            }
        });
      
    }
});

router.get('/showProfile', function(req, res, next){
    if(!req.session.email){
        res.render('index'); 
    }else{
        var board_idx = req.query.index;    
        mysqlDB.getConnection(function(err, connection){
            if(err){
                console.log('quey error'+err);
            }else{  
                var query = 'select users.userId, users.email, users.userProfile from users where userId = (select board.userId_w from board where board.board_num=?)'
                connection.query(query, [board_idx], function(err, rows, fields){
                    if(err){
                        console.log('quey error'+err);
                    }else{     
                        console.log('프로필 보기' + JSON.stringify(rows[0]));
                        var params = {
                            email : rows[0].email, 
                            profileImage : rows[0].userProfile, 
                            userId : rows[0].userId,
                            func : 'showProfile'
                        };
                        res.render('profile',params);
                    }
                });   
            }
        });
    }
});

module.exports = router;
