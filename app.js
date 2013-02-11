
/**
 * Module dependencies.
 */

var express = require('express')
  , routes  = require('./routes')
  , http    = require('http')
  , path    = require('path')
  , config  = require('config');
  
var app = express();

app.configure(function(){

  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());


  // Less middle ware to auto-compile less files
  var publicPath = path.join(__dirname, 'public');
  var lessMiddleware = require("less-middleware");
  app.use(lessMiddleware({
    src: publicPath,
    // Compress the files
    compress: true,
    optimization: 2
  }));

  // Public directory
  app.use(express.static( publicPath ) );


  // Pass values too the templates
  app.use(function(req, res, next) {          
    res.locals.req = req; 
    next()
  });

  // Must be set after the locals overiding
  app.use(app.router);

});

app.configure('development', function(){
  app.use(express.errorHandler());
});
;
http.createServer(app).listen(app.get('port'), function(){
  // Creates routes explicitely
  routes(app);
  console.log("Express server listening on port " + app.get('port'));  
});
