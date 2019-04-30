var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var profileRouter = require('./routes/profile');
var board_free_Router = require('./routes/board-free');
var app = express();

var session = require('express-session');
var MySQLStroe = require('express-mysql-session')(session);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 정적 파일 저장경로 (절대경로)
app.use(express.static(path.join(__dirname, 'public'))); // 공통 폴더 경로
app.use('/userProfiles',express.static(path.join(__dirname, 'userProfiles'))); //userProfiles 이미지 폴더 경로 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }))

//세션
var options = {
  host : "localhost",
  port : 3306, //mysql db port
  user : "root",
  password: "root",
  database : "HandleCar",
}
var sessionStore = new MySQLStroe(options);
var DateNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
app.use(session({
  secret: '!@3)*5&90#^8$7&4@+%^,.|\(#16@)13(4(%)*',
  store:sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: DateNow,  // 세션 연결 시작 날짜&시간
    maxAge : 24000 * 60 * 60 // 쿠키 유효기간 24시간  
  }
})); 

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/profile',profileRouter);
app.use('/board-free',board_free_Router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
