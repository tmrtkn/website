var express = require('express');
var fortune = require('./lib/fortunes.js');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var dns = require('dns');
 
var spawn = require('child_process').spawn;
var proc;

//var ffmpeg = require('fluent-ffmpeg');

/*
var command = ffmpeg("/dev/v4l/by-id/usb-046d_0825_6CE4C560-video-index0")
    .inputOptions('-r 24')
    .on('start', function(commandLine) {
        console.log('Starting ffmpeg: ' + commandLine);
    })
    .on('end', function(d) {
        console.log('Ending ffmpeg: ' + d);
    })
    .pipe(outStream, { end: true});
*/
// ["-y", "-f", "video4linux2", "-i", "/dev/v4l/by-id/usb-046d_0825_6CE4C560-video-index0", "-update", "1", "-r", "1", "/var/www/test/testffmpeg.jpeg"];


app.set('port', process.env.PORT || 8888);

// Static pages
app.use(express.static(__dirname + '/public'));

/// set up handlebards view engine
var handlebars = require('express3-handlebars')
    .create({ defaultLayout:'main'});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.use('/strm', express.static(path.join(__dirname, '/strm')));

app.use(function(req, res, next) {
    res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
    next();
});

var logRequest = function(req, res) {
  console.log("Request from", req.connection.remoteAddress, req.headers['X-Forwarded-For']);
  console.log("Got request for: ", req.path);
}

app.get('/', function(req, res) {
    logRequest(req, res);
    res.render('home');
});

app.get('/stream', function(req, res) {
    res.sendFile(__dirname + "/stream.html");
});

app.get('/about', function(req,res) {
    logRequest(req,res);
    res.render('about', { 
        fortune: fortune.getFortune(),
        pageTestScript: '/qa/tests-about.js'
    });
});

// 404 catch-all handler (middleware)
app.use(function(req, res, next) {
    logRequest(req,res);
    res.status(404);
    res.render('404');
});

// 500 error handler (middleware)
app.use(function(err, req, res, next) {
    logRequest(req,res);
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

http.listen(app.get('port'), function() {
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});

var sockets = {};
 
io.on('connection', function(socket) {
  console.log("New connection");

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);
 
  socket.on('disconnect', function() {
    console.log("Disconnecting " + socket.id);
    delete sockets[socket.id];
 
    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false);
      if (proc) {
          proc.kill();
      }
      fs.unwatchFile('/var/www/test/testffmpeg.jpeg');
    }
  });
 
  socket.on('start-stream', function() {
    console.log('start-stream');
      startStreaming(io);
  });
 
});

/*
http.listen(3000, function() {
console.log('listening on *:3000');
});
*/

function stopStreaming() {
    if (Object.keys(sockets).length == 0) {
        app.set('watchingFile', false);
        if (proc) proc.kill();
        fs.unwatchFile('/var/www/test/testffmpeg.jpeg');
    }
}

function startStreaming(io) {
    console.log("start streaming...");

    if (app.get('watchingFile')) {
        console.log('Sending liveStream');
          console.log("Proc: " + proc);
        io.sockets.emit('liveStream', 'testffmpeg.jpeg?_t=' + (Math.random() * 100000));
        return;
    }

    //var args = ["-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];
    var args2 = ["-y", "-f", "video4linux2", "-i", "/dev/video0", "-update", "1", "-r", "1", "/var/www/test/testffmpeg.jpeg"];

    //proc = spawn('raspistill', args);
    proc = spawn('ffmpeg', args2); 
    console.log('proc', proc.killed);

    console.log('Watching for changes...');

    app.set('watchingFile', true);

    fs.watchFile('/var/www/test/testffmpeg.jpeg', function(current, previous) {
        console.log('File has changed.');
        io.sockets.emit('liveStream', '/strm/testffmpeg.jpeg?_t=' + (Math.random() * 100000));
    })

}
