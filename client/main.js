const socket = io('http://localhost:3000');
let peerConnections = new Map(); // userId -> RTCPeerConnection
let localStream;
let currentUserId = '';

// STUN 서버 설정
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// UI 업데이트 함수들
function updateStatus(message) {
  console.log('Status update:', message);
  document.getElementById('connectionStatus').textContent = message;
}

function updateUserId(userId) {
  currentUserId = userId;
  document.getElementById('userId').textContent = userId;
  console.log('User ID set to:', userId);
}

function updateUserCount(count) {
  document.getElementById('userCount').textContent = count;
  console.log('User count updated:', count);
}

// 비디오 요소 생성 함수
function createVideoElement(userId, isLocal = false) {
  // 이미 존재하는지 확인
  if (document.getElementById(`video-${userId}`)) {
    console.log(`Video element for ${userId} already exists`);
    return document.getElementById(`video-${userId}`);
  }

  const videoContainer = document.getElementById('videoContainer');

  const videoWrapper = document.createElement('div');
  videoWrapper.className = 'video-wrapper';
  videoWrapper.id = `wrapper-${userId}`;

  const title = document.createElement('h3');
  title.textContent = isLocal ? '내 화면' : `사용자 ${userId}`;

  const video = document.createElement('video');
  video.id = `video-${userId}`;
  video.autoplay = true;
  video.playsinline = true;
  if (isLocal) {
    video.muted = true;
  }

  videoWrapper.appendChild(title);
  videoWrapper.appendChild(video);
  videoContainer.appendChild(videoWrapper);

  console.log(`Created video element for ${userId}`);
  return video;
}

// 비디오 요소 제거 함수
function removeVideoElement(userId) {
  const videoWrapper = document.getElementById(`wrapper-${userId}`);
  if (videoWrapper) {
    videoWrapper.remove();
    console.log(`Removed video element for ${userId}`);
  }
}

async function joinRoom() {
  const userId = `user_${Math.random().toString(36).slice(2)}`;
  console.log('Joining room with userId:', userId);
  updateUserId(userId);
  updateStatus('카메라 접근 중...');

  try {
    // 미디어 스트림 가져오기
    console.log('Requesting media devices...');
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    console.log('Media devices accessed successfully');

    // 로컬 비디오 표시
    const localVideo = createVideoElement(userId, true);
    localVideo.srcObject = localStream;
    console.log('Local video stream set');

    // Socket.IO 이벤트 리스너 설정
    setupSocketListeners();

    // 방 입장
    console.log('Emitting join event...');
    socket.emit('join', { userId });
    updateStatus('방 입장 중...');
  } catch (error) {
    console.error('Error accessing media devices:', error);
    updateStatus('카메라/마이크 접근 실패');
    alert('카메라나 마이크에 접근할 수 없습니다.');
  }
}

function setupSocketListeners() {
  console.log('Setting up socket listeners...');

  // 방 사용자 목록 수신
  socket.on('roomUsers', (data) => {
    console.log('Room users received:', data.users);
    // 기존 사용자들과 연결 설정
    data.users.forEach((userId) => {
      if (userId !== currentUserId && !peerConnections.has(userId)) {
        createPeerConnection(userId);
      }
    });
  });

  // 시그널 수신 처리
  socket.on('signal', async (data) => {
    const { signal, fromUserId } = data;
    console.log(
      'Received signal from:',
      fromUserId,
      'Type:',
      signal.type || 'candidate',
    );

    try {
      let peerConnection = peerConnections.get(fromUserId);

      if (signal.type === 'offer') {
        console.log('Received offer, creating answer');
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('signal', {
          signal: peerConnection.localDescription,
          type: 'answer',
          targetUserId: fromUserId,
        });
      } else if (signal.type === 'answer') {
        console.log('Received answer');
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal),
        );
      } else if (signal.candidate) {
        console.log('Received ICE candidate');
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  });

  // 새 사용자 입장 처리
  socket.on('userJoined', async (data) => {
    console.log('New user joined:', data.userId);
    updateStatus('새 사용자 입장');

    // 새 사용자와의 연결 생성 (중복 방지)
    if (!peerConnections.has(data.userId)) {
      createPeerConnection(data.userId);

      // 새 사용자에게 offer 전송
      const peerConnection = peerConnections.get(data.userId);
      if (peerConnection) {
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          socket.emit('signal', {
            signal: peerConnection.localDescription,
            type: 'offer',
            targetUserId: data.userId,
          });
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      }
    }
  });

  // 사용자 퇴장 처리
  socket.on('userLeft', (data) => {
    console.log('User left:', data.userId);
    updateStatus('사용자 퇴장');

    // 연결 정리
    const peerConnection = peerConnections.get(data.userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.delete(data.userId);
    }

    // 비디오 요소 제거
    removeVideoElement(data.userId);
  });

  // 방 정보 수신
  socket.on('roomInfo', (data) => {
    console.log('Room info received:', data);
    updateUserCount(data.userCount);
  });

  // 연결 상태 처리
  socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('서버 연결됨');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateStatus('서버 연결 끊김');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateStatus('서버 연결 실패');
  });
}

function createPeerConnection(targetUserId) {
  console.log('Creating peer connection for:', targetUserId);

  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections.set(targetUserId, peerConnection);

  // 로컬 스트림을 피어 연결에 추가
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
    console.log('Added track to peer connection:', track.kind);
  });

  // 원격 스트림 처리
  peerConnection.ontrack = (event) => {
    console.log('Received remote stream from:', targetUserId);
    const remoteVideo = createVideoElement(targetUserId);
    remoteVideo.srcObject = event.streams[0];
    updateStatus('화상 통화 연결됨');
  };

  // ICE 후보 처리
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate to:', targetUserId);
      socket.emit('signal', {
        signal: event.candidate,
        type: 'candidate',
        targetUserId,
      });
    }
  };

  // ICE 연결 상태 변경 처리
  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      `ICE connection state for ${targetUserId}:`,
      peerConnection.iceConnectionState,
    );
    updateStatus(`ICE 상태: ${peerConnection.iceConnectionState}`);
  };

  // 연결 상태 변경 처리
  peerConnection.onconnectionstatechange = () => {
    console.log(
      `Connection state for ${targetUserId}:`,
      peerConnection.connectionState,
    );
    updateStatus(`연결 상태: ${peerConnection.connectionState}`);
  };

  return peerConnection;
}

// 컨트롤 함수들
function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const button = event.target;
      button.textContent = videoTrack.enabled ? '비디오 끄기' : '비디오 켜기';
    }
  }
}

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const button = event.target;
      button.textContent = audioTrack.enabled ? '오디오 끄기' : '오디오 켜기';
    }
  }
}

async function shareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const localVideo = document.getElementById(`video-${currentUserId}`);
    localVideo.srcObject = screenStream;

    // 모든 피어 연결에 화면 공유 트랙 추가
    const senders = Array.from(peerConnections.values()).map((pc) =>
      pc.getSenders().find((sender) => sender.track?.kind === 'video'),
    );

    senders.forEach((sender) => {
      if (sender) {
        sender.replaceTrack(screenStream.getVideoTracks()[0]);
      }
    });

    updateStatus('화면 공유 중');
  } catch (error) {
    console.error('Error sharing screen:', error);
    alert('화면 공유를 시작할 수 없습니다.');
  }
}

// 페이지 로드 시 자동으로 방 입장
window.addEventListener('load', () => {
  console.log('Page loaded, starting join process...');
  joinRoom();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  // 모든 피어 연결 정리
  peerConnections.forEach((pc) => pc.close());
  peerConnections.clear();

  socket.emit('disconnect');
});
