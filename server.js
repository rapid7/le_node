var express = require('express');
var logentries = require("./lib/logentries.js");
var app = express();

app.configure(function(){
  app.use(express.logger({
    stream:logentries.stream({token:'ae89ff6b-6cf9-409d-bcab-9f12c97f83e4'})
  }));
  app.use(app.router);
});

app.get('/', function(req, res){
  res.send('Hello World');
});

app.listen(process.env.PORT);