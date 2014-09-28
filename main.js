
var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

var dataPath = process.argv[2] || 'data/'
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath);
}

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

io.on('connection', function(socket){

  console.log('connected!');

  socket.on('saveData', function(results) {

    var stream;

    if (results.data) {
      stream = fs.createWriteStream(dataPath + 'frame' + results.frameNumber + '.json');
    } else {
      return;
    }

    stream.on('open', function() {
      stream.end(JSON.stringify(results.data), 'utf-8');
    });

    socket.emit('dataSaved', results.frameNumber);
  });
});

app.use(express.static(__dirname + '/public'));
