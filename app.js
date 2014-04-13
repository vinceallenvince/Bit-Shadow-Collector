var connect = require('connect'),
    fs = require('fs'),
    io = require('socket.io').listen(1337);

connect(connect.static(__dirname + '/public')).listen(8000);

io.set('heartbeat timeout', 10000);
io.set('heartbeat interval', 9000);
io.sockets.on('connection', function(socket) {
  socket.on('setData', function(results) {
    var stream;
    if (results.data) {
    	stream = fs.createWriteStream('data/frame' + results.frameNumber + '.json');
    } else {
      return;
    }

    stream.on('open', function() {
      stream.end(JSON.stringify(results.data), 'utf-8');
    });

    socket.emit('dataSet', results.frameNumber);
  });
});
