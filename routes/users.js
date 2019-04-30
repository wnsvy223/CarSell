var express = require('express');
var router = express.Router();
var mysqlDB = require('../mysqlDB');


/* GET users listing. */
router.get('/', function(req, res, next) {
  console.log("유저창" + JSON.stringify(req.session));
});


module.exports = router;
