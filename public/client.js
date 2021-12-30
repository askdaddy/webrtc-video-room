let signalConnection;
const peerConnections = {};
let localStream;
let localId = undefined;

const peerConf = {
    'iceServers': [
        {'urls': 'stun:stun.services.mozilla.com'},
        {'urls': 'stun:stun.stunprotocol.org:3478'},
        // {'urls': 'stun:stun.l.google.com:19302'}
    ]
}
const constraints = {
    video: {
        aspectRatio:1.777777,
        frameRate: 60
    },
    audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 24000,
        channelCount: 1,
        volume: 0.8
    }
}

function domReady() {
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints)
            .then(getUserMediaSuccess)
            .catch(console.error);
    } else {
        alert('Your browser does not support getUserMedia API');
    }
}

function getUserMediaSuccess(stream) {
    localStream = stream;
    const main = document.getElementById("main")
    let local_media = document.createElement("video");
    local_media.setAttribute("id", "local");
    local_media.setAttribute("muted", true);
    local_media.setAttribute("autoplay", "autoplay");
    local_media.setAttribute("controls", "");
    local_media.srcObject = localStream;
    main.append(local_media);

    connectSignal();
}

function connectSignal() {
    signalConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    signalConnection.onmessage = signalHandler;
}

function signalHandler(message) {
    const signal = JSON.parse(message.data)
        , uuid = signal.uuid
        , cmd = signal.cmd;

    let _pc;
    switch (cmd) {
        case "onserve":
            // got UUID from signal server.
            const idLabel = document.getElementById("uuid");
            if (idLabel) idLabel.innerHTML = `uuid: ${uuid}`;
            localId = uuid;
            broadcast({"cmd": "join"});
            break;
        case "close":
            console.log(`peer[${uuid}] closed.`);
            const close_tag = document.getElementById(uuid);
            if (close_tag) close_tag.remove();
            _pc = peerConnections[uuid]
            if (_pc) {
                _pc.close();
            }
            peerConnections[uuid] = undefined;
            break;
        case "join":
            _pc = launchPeer(uuid);
            if (_pc)
                _pc.createOffer()
                    .then(function (desc) {
                        createdDescription(uuid, desc)
                    })
                    .catch(console.error);
            break;
        case "ice":
            _pc = launchPeer(uuid);
            if (_pc)
                _pc.addIceCandidate(new RTCIceCandidate(signal.ice))
                    .catch(console.error);
            break;
        case "sdp":
            _pc = launchPeer(uuid);
            if (_pc)
                _pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(function () {
                        if (signal.sdp.type == 'offer') {
                            _pc.createAnswer()
                                .then(function (desc) {
                                    createdDescription(uuid, desc);
                                })
                                .catch(console.error);
                        }
                    })
                    .catch(console.error);
            break;
        default:
            console.error(`cmd did not match any act.`, signal);
            break;
    }
}

function launchPeer(uuid) {
    console.log(`launchPeer:`, uuid);
    let _pc = peerConnections[uuid];
    if (!_pc) {
        console.log(`new peerConnection: `, uuid);
        _pc = peerConnections[uuid] = new RTCPeerConnection(peerConf);
        _pc.onicecandidate = function (ev) {
            gotIceCandidate(uuid, ev.candidate);
        };
        _pc.ontrack = function (ev) {
            gotRemoteStream(uuid, ev.streams[0]);
        };

        if (localStream)
            _pc.addStream(localStream);
    }
    return _pc;
}

function gotIceCandidate(uuid, candidate) {
    if (candidate !== null) {
        sendTo({'cmd': 'ice', 'ice': candidate}, uuid);
    }
}

function gotRemoteStream(uuid, stream) {
    const others = document.getElementById("others");
    let _media = document.getElementById(`${uuid}`);
    if (!_media) {
        _media = document.createElement("video");
        _media.setAttribute("autoplay", "autoplay");
        _media.setAttribute("id", `${uuid}`);

        others.append(_media);
    }
    _media.srcObject = stream;
}

function createdDescription(uuid, description) {
    const pc = peerConnections[uuid];
    if (!pc) return;
    pc.setLocalDescription(description).then(function () {
        sendTo({'cmd': 'sdp', 'sdp': pc.localDescription}, uuid);
    }).catch(console.error);
}

function broadcast(data) {
    if (!signalConnection) return console.error(`broadcast: No signal connection.`);
    signalConnection.send(JSON.stringify(data));
}

function sendTo(data, uuid) {
    if (!signalConnection) return console.error(`sendTo: No signal connection.`);
    if (uuid) {
        data['to'] = uuid;
        signalConnection.send(JSON.stringify(data));
    } else
        console.error(`sendTo: empty UUID.`);
}


