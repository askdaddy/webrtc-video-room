let serverConnection;
const peerConnections = {};
let localStream;
const peerConf = {
    'iceServers': [
        {'url': 'stun:stun.services.mozilla.com'},
        {'urls': 'stun:stun.stunprotocol.org:3478'},
        {'urls': 'stun:stun.l.google.com:19302'}
    ]
}
const constraints = {
    video: true,
    audio: false
}

function domReady() {
    serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    serverConnection.onmessage = messageHandler;

    serverConnection.onopen = function () {
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(getUserMediaSuccess)
                .catch(console.error);
        } else {
            alert('Your browser does not support getUserMedia API');
        }
    }
}

function messageHandler(message) {
    if (!message.data || typeof message.data !== "string") return;
    const signal = JSON.parse(message.data)
        , uuid = signal.uuid;

    console.log(signal);
    if (signal.join) {
        console.log('on join >>',signal);
        call(uuid);
        return;
    }

    const _pc = launchPeer(uuid);
    if (!_pc) return;


    if (signal.sdp) {
        console.log(`sdp: `, signal);
        _pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(function () {
                if (signal.sdp.type == 'offer') {
                    _pc.createAnswer()
                        .then(function (desc) {
                            createdDescription(_pc, desc);
                        })
                        .catch(console.error);
                }
            })
            .catch(console.error);
    }

    if (signal.ice) {
        console.log(`ice: `, signal);
        _pc.addIceCandidate(new RTCIceCandidate(signal.ice))
            .catch(console.error);
    }

    if (signal.close) {
        // TODO remove <video> object.
        console.info(signal);
        const close_tag = document.getElementById(signal.uuid);
        if (close_tag) close_tag.remove();
        peerConnections[signal.uuid] = undefined;
    }
}


function call(uuid) {
    const tmpPeerConn = new RTCPeerConnection(peerConf);
    peerConnections[uuid] = tmpPeerConn;
    tmpPeerConn.onicecandidate = gotIceCandidate;
    tmpPeerConn.ontrack = function (ev) {
        gotRemoteStream(uuid, ev.streams[0]);
    }
    tmpPeerConn.addStream(localStream);

    tmpPeerConn.createOffer()
        .then(function (desc) {
            createdDescription(tmpPeerConn, desc)
        })
        .catch(console.error);

}

function launchPeer(uuid) {
    console.log(`launchPeer:`, uuid);
    let _pc = peerConnections[uuid];
    if (!_pc) {
        _pc = new RTCPeerConnection(peerConf);
        peerConnections[uuid] = _pc;
        // return console.error(`empty peer`);
    }
    _pc.onicecandidate = gotIceCandidate;
    _pc.ontrack = function (ev) {
        gotRemoteStream(uuid, ev.streams[0]);
    };
    _pc.addStream(localStream);
    return _pc;
}

function gotIceCandidate(ev) {
    console.log(`got ice: `, ev.candidate);
    if (ev.candidate !== null) {
        serverConnection.send(JSON.stringify({'ice': ev.candidate}));
    }
}

function gotRemoteStream(uuid, stream) {
    console.log('got remote stream: ', uuid);
    const others = document.getElementById("others");
    const _media = document.createElement("video");
    _media.setAttribute("autoplay", "autoplay");
    _media.setAttribute("id", uuid);

    others.append(_media);
    _media.srcObject = stream;
}

function createdDescription(pc, description) {
    if (!pc) return;
    console.log('createdDescription');
    pc.setLocalDescription(description).then(function () {
        serverConnection.send(JSON.stringify({'sdp': pc.localDescription}));
    }).catch(console.error);
}


function getUserMediaSuccess(stream) {
    localStream = stream;
    const main = document.getElementById("main")
    let local_media = document.createElement("video");
    local_media.setAttribute("id", "local");
    local_media.setAttribute("muted", true);
    local_media.setAttribute("autoplay", "autoplay");
    local_media.setAttribute("controls", "");

    local_media.srcObject = stream;
    main.append(local_media);

    serverConnection.send(JSON.stringify({"join": true}));
}


