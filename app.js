var fs = require('fs'),
    exec = require('child_process').exec,
    express = require('express'),
    env = process.env.NODE_ENV,
    app = express();

if (env === 'development') {
  app.get('/datazooka.js', function(req, res) {
    exec('./build.sh', {maxBuffer: 400000}, function(err, built) {
      if (err) throw err;
      res.type('js');
      res.send(built);
    });
  });
  app.use(express.static('src'));
}

app.use(express.static('public'));

var port = process.env.PORT || 5000;
app.listen(port);
console.log('listening on port ' + port);
