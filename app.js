
/**
 * Module dependencies.
 */

var express = require('express')
  , routes  = require('./routes')
  , http    = require('http')
  , path    = require('path')
  , config  = require('config')
    , jade  = require('jade')
      , fs  = require('fs');
  
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
  app.use(config.root, express.static(publicPath) );


  // Pass values too the templates
  app.use(function(req, res, next) {          
    res.locals.req = req;        
    res.locals.root = config["root"]; 
    // Add search URL
    res.locals.searchUrl = config["search-engine"]["url"];
    // URL to share
    res.locals.shareUrl = config["search-engine"]["url"] + req.path.substring(1);
    
    // Create embed
    res.locals.getEmbed = function() {
      // Get the templaye from file
      var tpl = fs.readFileSync( app.get('views') + "/embed.jade", "utf8");          
      // Compiles the template function
      var templateFn = jade.compile(tpl);   
      // Returne the template parsed   
      return templateFn({ url: config["search-engine"]["url"] + req.path.substring(1) + "?no-menu=1" });
    };

    res.locals.getYearClass = function(year) {
      classes = []
      if(year%10 == 0) classes.push("decade")
      if(year%2 != 0) classes.push("odd")
      return classes.join(" ")
    }

    res.locals.getYearLabel = function(year) {      
      if(year%10 == 0) return year
      else return String(year/100).split(".")[1]
    }

    // Activate or not the main menu
    res.locals.mainMenu = ! req.query["no-menu"];

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
