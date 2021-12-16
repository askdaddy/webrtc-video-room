let uuid;
let serverConnection;
let peerConnection;

function domReady() {
    uuid = createUUID();

    serverConnection = new WebSocket('ws://' + window.location.hostname + ':12000');
    serverConnection.onmessage = messageHandler;

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        })
            .then(getUserMediaSuccess)
            .catch(errorHandler);
    } else {
        alert('Your browser does not support getUserMedia API');
    }
}

function messageHandler(message) {

}

function getUserMediaSuccess(stream) {
    // localStream = stream;
    // localVideo.srcObject = stream;
    let local_media = $("<video>");
    local_media.attr("autoplay", "autoplay");
    local_media.attr("controls", "");
    $('body').append(local_media);
    local_media[0].srcObject = stream;
}

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function errorHandler(error) {
    console.log(error);
}
