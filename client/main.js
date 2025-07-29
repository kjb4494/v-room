const socket = io('http://localhost:3000');
let peerConnection;

async function joinRoom() {
  const userId = `user_${Math.random().toString(36).slice(2)}`;

  // gRPC로 접속 요청 (간소화 위해 생략, Socket.IO로 대체)
  socket.emit('join', { userId });

  // WebRTC 설정
  peerConnection = new RTCPeerConnection();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  document.getElementById('localVideo').srcObject = stream;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = (event) => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { signal: event.candidate });
    }
  };

  socket.on('signal', async (signal) => {
    if (signal.sdp) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal),
      );
      if (signal.type === 'offer') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { signal: peerConnection.localDescription });
      }
    } else if (signal.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
    }
  });

  socket.on('userJoined', async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { signal: peerConnection.localDescription });
  });
}
