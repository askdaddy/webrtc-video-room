const PORT = 12000

const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const requestListener = function (req, res) {
    console.log('request received: ' + req.url);

    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(fs.readFileSync('public/index.html'));
    } else if (req.url === '/client.js') {
        res.writeHead(200, {'Content-Type': 'application/javascript'});
        res.end(fs.readFileSync('public/client.js'));
    }
}

const httpServer = http.createServer(requestListener);
httpServer.listen(PORT, '0.0.0.0');

const wsServer = new WebSocket.WebSocketServer({server: httpServer, clientTracking: true});

wsServer.on('connection', function (ws) {
    ws.userData = "";

    ws.on('message', function (data, isBinary) {
        // Broadcast any received message to all clients
        console.log(`received: ${data}`);
        ws.userData = data;

        wsServer.clients.forEach(function (client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data, {binary: isBinary});
            }
        });
    });

    ws.on('close', function (code, reason) {
        console.log(`connection close[${code}]: ${reason}`);

        // broadcasting to every other connected WebSocket clients, excluding itself.
        wsServer.clients.forEach(function (client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                const tmp = JSON.parse(ws.userData);
                tmp['close'] = true;
                client.send(JSON.stringify(tmp));
            }
        });
    });
});


