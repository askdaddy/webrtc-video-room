const HTTPS_PORT = 8443
const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

const serverConfig = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};
const handleRequest = function (request, response) {
    // Render the single client html file for any request the HTTP server receives
    console.log('request received: ' + request.url);

    if (request.url === '/') {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(fs.readFileSync('public/index.html'));
    } else if (request.url === '/client.js') {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync('public/client.js'));
    }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

const wsServer = new WebSocket.WebSocketServer({server: httpsServer, clientTracking: true});

wsServer.on('connection', function (client, req) {
    const ip = req.socket.remoteAddress;
    const port = req.socket.remotePort;
    const id = createUUID();
    client['remoteAddress'] = `${ip}:${port}`;
    client['socket_id'] = id;
    console.info(`Client connected[${client.socket_id}] from ${client.remoteAddress}`);

    client.on('message', function (data, isBinary) {
        try {
            const _do = JSON.parse(data);
            _do.uuid = client.socket_id;
            wsServer.broadcast(_do, client);
        } catch (e) {
            console.error(e);
        }
    });

    client.on('close', function (code, reason) {
        console.log(`connection close[${code}]: ${reason}`);
        // broadcasting to every other connected WebSocket clients, excluding itself.
        wsServer.broadcast({"close": true, "uuid": client.socket_id}, client);
    });
});

wsServer.broadcast = function (messageObj, exclude) {
    this.clients.forEach(function (client) {
        if (client !== exclude && client.readyState === client.OPEN) {
            client.send(JSON.stringify(messageObj));
        }
    });
}


function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return  s4() + '-' + s4() + '-' + s4() + s4() ;
}
