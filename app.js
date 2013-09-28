var connect = require('connect'),
    fs = require('fs'),
    io = require('socket.io').listen(1337);

connect(connect.static(__dirname + '/public')).listen(8000);

io.sockets.on('connection', function(socket) {
  socket.on('setData', function(data) {
    var stream;
    if (data) {
    	stream = fs.createWriteStream('agent_data.txt');
    } else {
      return;
    }

    stream.on('open', function() {
      stream.end(JSON.stringify([data]), 'utf-8');
    });

    socket.emit('dataSet', {id: data.id});
  });
});
