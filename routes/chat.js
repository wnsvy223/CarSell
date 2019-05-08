var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    if(req.session.email){
      console.log("세션이 유지중" + req.session.email +' / ' +req.session.userProfile);
      var params = {
          email : req.session.email,
          userId : req.session.userId,
          userProfile : req.session.userProfile
      }
      res.render('chat', params);
    }else{
      console.log("세션이 끊어짐");    
      res.render('index');
    }
});

module.exports = router;