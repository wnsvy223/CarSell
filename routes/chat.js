var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    if(req.session.email){
      console.log("세션이 유지중" + req.session.email +' / ' +req.session.userProfile);
      var userProfile = resetPath(req.session.userProfile);
      console.log('새로운 경로 : ' + userProfile);
      var params = {
          email : req.session.email,
          userId : req.session.userId,
          userProfile : userProfile
      }
      res.render('chat', params);
    }else{
      console.log("세션이 끊어짐");    
      res.render('index');
    }
});

// 프로필 사진 경로 재 생성 함수
function resetPath(oldFilePath){
  var front = oldFilePath.substring(0,13) + '\\';
  var back = oldFilePath.substring(13);
  var newPath = front + back;
  return newPath;
}

module.exports = router;