
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
  if (req.url.match(/\/build[\/\w]*$/)) {
    exec('.' + req.url, function(err, stdout) {
      if (err) return notFound(req.url, res);
      res.writeHead(200, {'Content-Type': 'application/javascript'});
      res.end(stdout);
    });
  } else {
    findFile(req.url, function(err, fileText, path) {
      if (err) {
        console.log('404: ' + req.url);
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('404 Not Found\n');
        return;
      }
      var ext = path.split('.').pop();
      if (ext === path) ext = 'html';
      var type = types[ext];
      if (!type) type = 'text/plain';
      res.writeHead(200, {'Content-Type': type});
      res.end(fileText);
    });
  }
}).listen(3000, 'localhost');

function findFile(path, callback, lastCheck) {
  fs.stat('.' + path, function(err, stats) {
    if (err) {
      if (lastCheck) return callback(true);
      var re = /\/(\w*)\.js$/,
          match = re.exec(path);
      if (!match) return callback(true);
      var dir = match[1],
          replace = '/' + (dir ? dir + '/' : '') + 'index.js';
      findFile(path.replace(re, replace), callback, true);
      return;
    }

    if (stats.isDirectory()) {
      findFile(path + '/index.html', callback, true);
      return;
    }

    fs.readFile('.' + path, 'utf8', function(err, fileText) {
      callback(err, fileText, path);
    });
  });
}


