
var outputFile = 'datazooka.js';   // Change this to your app file name.
var buildScript = './build';   // Change this to your app's build script.


var http = require('http'),
    fs = require('fs'),
    exec = require('child_process').exec,
    types;

types = {
  js: 'application/javascript',
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',

  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

http.createServer(function (req, res) {
  if (req.url === '/' + outputFile) {
    exec(buildScript, function(err, stdout) {
      if (err) return notFound(req.url, res);
      res.writeHead(200, {'Content-Type': 'application/javascript'});
      res.end(stdout);
    });
  } else {
    findFile(req.url, res);
  }
}).listen(3000, 'localhost');

function findFile(path, res) {
  fs.stat('.' + path, function(err, stats) {
    if (err) return notFound(path, res);
    if (stats.isDirectory()) {
      findFile(path + '/index.html', res);
      return;
    }
    if (!stats.isFile()) return notFound(path, res);

    fs.readFile('.' + path, 'utf8', function(err, fileText) {
      if (err) throw err;
      var type = types[path.split('.').pop()];
      if (!type) type = 'text/plain';
      res.writeHead(200, {'Content-Type': type});
      res.end(fileText);
    });
  });
}


function notFound(path, res) {
  console.log('404: ' + path);
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('404 Not Found\n');
}

