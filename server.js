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
httpsServer.listen(8443, '0.0.0.0');

const wsServer = new WebSocket.WebSocketServer({server: httpsServer, clientTracking: true});

wsServer.on('connection', function (client, req) {
    client['uuid'] = createUUID();
    console.info(`Client connected[ ${client.uuid} ]`);

    client.on('message', function (data) {
        try {
            const _do = JSON.parse(data);
            _do.uuid = client.uuid;
            const _to = _do.to;
            if (_to) {
                wsServer.sendTo(_do, _to);
            } else
                wsServer.broadcast(_do, client);
        } catch (e) {
            console.error(e);
        }
    });

    client.on('close', function (code, reason) {
        console.log(`connection close[${code}]: ${reason}`);
        // broadcasting to every other connected WebSocket clients, excluding itself.
        wsServer.broadcast({"cmd":"close", "uuid": client.uuid}, undefined);
    });

    client.send(JSON.stringify({"cmd":"onserve", "uuid": client.uuid}));
});

wsServer.broadcast = function (messageObj, exclude) {
    wsServer.clients.forEach(function (client) {
        if (client && client !== exclude && client.readyState === client.OPEN) {
            console.log(`Broadcast to: `, client.uuid);
            client.send(JSON.stringify(messageObj));
        }
    });
}

wsServer.sendTo = function (messageObj, who) {
    wsServer.clients.forEach(function (client) {
        if (client && client.uuid && client.uuid === who) {
            console.log(`Only send to :`, client.uuid);
            client.send(JSON.stringify(messageObj));
        }
    });
}

let _aid = 0;

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    // return s4() + '-' + s4() + s4();
    return ++_aid;
}
