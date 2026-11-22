/**
 * WebRTC P2P Video Call - Serverless SDP Exchange
 * Vanilla JavaScript implementation
 */

// ============================================================
// 1. WebRTC Konfiguratsiyasi (Google STUN)
// ============================================================
const configuration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};

// ============================================================
// 2. Global Holat O'zgaruvchilari (State)
// ============================================================
let localStream = null;
let remoteStream = null;
let peerConnection = null;

let isMicEnabled = true;
let isCamEnabled = true;

let generatedOfferSdp = null;
let generatedAnswerSdp = null;

let isOffererFlow = false;
let isAnswererFlow = false;

// ============================================================
// 3. DOM Elementlari
// ============================================================
const connectionStatusBadge = document.getElementById('connectionStatusBadge');
const connectionStatusText = document.getElementById('connectionStatusText');
const iceStatusBadge = document.getElementById('iceStatusBadge');
const iceStatusText = document.getElementById('iceStatusText');
const protocolWarning = document.getElementById('protocolWarning');
const btnCloseWarning = document.getElementById('btnCloseWarning');

// Video elements
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const localPlaceholder = document.getElementById('localPlaceholder');
const remoteVideoContainer = document.getElementById('remoteVideoContainer');
const localVideoContainer = document.getElementById('localVideoContainer');
const btnFullscreen = document.getElementById('btnFullscreen');

// Indicators
const localMicIndicator = document.getElementById('localMicIndicator');
const localCamIndicator = document.getElementById('localCamIndicator');

// Media controls
const btnToggleCam = document.getElementById('btnToggleCam');
const lblToggleCam = document.getElementById('lblToggleCam');
const btnToggleMic = document.getElementById('btnToggleMic');
const lblToggleMic = document.getElementById('lblToggleMic');
const btnStartMedia = document.getElementById('btnStartMedia');
const btnDisconnect = document.getElementById('btnDisconnect');

// ICE progress
const iceProgressContainer = document.getElementById('iceProgressContainer');
const iceProgressBar = document.getElementById('iceProgressBar');
const iceProgressMessage = document.getElementById('iceProgressMessage');

// Offerer UI
const offererCard = document.getElementById('offererCard');
const stepCreateOffer = document.getElementById('stepCreateOffer');
const btnCreateOffer = document.getElementById('btnCreateOffer');
const stepDownloadOffer = document.getElementById('stepDownloadOffer');
const btnDownloadOffer = document.getElementById('btnDownloadOffer');
const stepUploadAnswer = document.getElementById('stepUploadAnswer');
const btnUploadAnswer = document.getElementById('btnUploadAnswer');
const fileInputAnswer = document.getElementById('fileInputAnswer');

// Answerer UI
const answererCard = document.getElementById('answererCard');
const stepUploadOffer = document.getElementById('stepUploadOffer');
const btnUploadOffer = document.getElementById('btnUploadOffer');
const fileInputOffer = document.getElementById('fileInputOffer');
const stepCreateAnswer = document.getElementById('stepCreateAnswer');
const btnCreateAnswer = document.getElementById('btnCreateAnswer');
const stepDownloadAnswer = document.getElementById('stepDownloadAnswer');
const btnDownloadAnswer = document.getElementById('btnDownloadAnswer');

// Details & Logs
const btnToggleDetails = document.getElementById('btnToggleDetails');
const detailsBody = document.getElementById('detailsBody');
const detailsChevron = document.getElementById('detailsChevron');
const sdpTextArea = document.getElementById('sdpTextArea');
const sdpTypeLabel = document.getElementById('sdpTypeLabel');
const btnCopySdp = document.getElementById('btnCopySdp');
const logEntries = document.getElementById('logEntries');
const btnClearLogs = document.getElementById('btnClearLogs');
const toastContainer = document.getElementById('toastContainer');

// ============================================================
// 4. Dastlabki Tekshirishlar & Xavfsizlik Talablari
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  checkProtocolAndEnvironment();
  log('Tizim tayyor. Google STUN serveri sozlandi.', 'info');
});

/**
 * HTTPS va Localhost xavfsizlik talabini tekshirish
 */
function checkProtocolAndEnvironment() {
  const isSecure = window.isSecureContext || 
                   location.protocol === 'https:' || 
                   location.hostname === 'localhost' || 
                   location.hostname === '127.0.0.1';

  if (!isSecure && location.protocol === 'file:') {
    protocolWarning.style.display = 'flex';
    log('Sahifa to\'g\'ridan-to\'g\'ri file:// orqali ochilgan. Kamera/mikrofon ishlashi uchun localhost yoki HTTPS tavsiya etiladi.', 'warning');
  }

  btnCloseWarning.addEventListener('click', () => {
    protocolWarning.style.display = 'none';
  });
}

// ============================================================
// 5. Toast va Log Xabarlar Tizimi
// ============================================================
function showToast(message, type = 'info', duration = 4500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function log(message, type = 'info') {
  const timeStr = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-msg">${escapeHtml(message)}</span>`;
  logEntries.appendChild(entry);
  logEntries.scrollTop = logEntries.scrollHeight;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Loglarni tozalash
btnClearLogs.addEventListener('click', () => {
  logEntries.innerHTML = '';
  log('Loglar tozalandi.', 'info');
});

// Tafsilotlar panelini ochish/yopish
btnToggleDetails.addEventListener('click', () => {
  detailsBody.classList.toggle('is-open');
  detailsChevron.classList.toggle('is-open');
});

// SDP nusxalash
btnCopySdp.addEventListener('click', () => {
  if (!sdpTextArea.value || sdpTextArea.value.trim() === '') {
    showToast('Nusxalash uchun SDP ma\'lumoti yo\'q!', 'warning');
    return;
  }
  navigator.clipboard.writeText(sdpTextArea.value).then(() => {
    showToast('SDP matni xotiraga nusxalandi!', 'success');
  }).catch(() => {
    sdpTextArea.select();
    document.execCommand('copy');
    showToast('SDP matni nusxalandi!', 'success');
  });
});

// ============================================================
// 6. MediaDevices API: Kamera va Mikrofonni Boshqarish
// ============================================================

/**
 * Kamera va mikrofon ruxsatlarini tekshirish va oqimni (stream) olish
 */
async function ensureLocalMediaStream() {
  if (localStream && localStream.active && localStream.getTracks().length > 0) {
    return localStream;
  }

  try {
    log('Kamera va mikrofon so\'ralmoqda...', 'info');
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    localPlaceholder.style.display = 'none';

    // Holatni yangilash
    isMicEnabled = true;
    isCamEnabled = true;
    updateTrackIndicators();
    updateMediaButtonStates();

    log('Mahalliy media (kamera va mikrofon) muvaffaqiyatli yoqildi.', 'success');
    showToast('Kamera va mikrofon ishga tushdi.', 'success');
    return localStream;
  } catch (error) {
    log(`Media ruxsatida xatolik: ${error.name} - ${error.message}`, 'error');
    handleMediaError(error);
    throw error;
  }
}

/**
 * Media xatoliklarini foydalanuvchiga tushunarli tilda tushuntirish
 */
function handleMediaError(error) {
  let userMsg = 'Kamera yoki mikrofonga ulanishda noma\'lum xatolik yuz berdi.';
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    userMsg = 'Kamera yoki mikrofonga ruxsat berilmadi! Brauzer manzil qatoridagi qulf belgisini bosib ruxsat bering.';
  } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    userMsg = 'Kamera yoki mikrofon qurilmasi topilmadi. Qurilma ulanganligini tekshiring.';
  } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    userMsg = 'Kamera boshqa dastur (masalan Zoom, Telegram yoki boshqa brauzer) tomonidan band qilingan.';
  } else if (error.name === 'OverconstrainedError') {
    userMsg = 'Talab qilingan video formati qo\'llab-quvvatlanmadi.';
  } else if (location.protocol === 'file:') {
    userMsg = 'file:// protokoli orqali ochilganda brauzer kamerani bloklashi mumkin. Localhost server orqali oching.';
  }
  showToast(userMsg, 'error', 6000);
}

/**
 * Mikrofonni yoqish / o'chirish
 */
function toggleMicrophone() {
  if (!localStream) {
    showToast('Avval kamerani va mikrofonni yoqing!', 'warning');
    return;
  }

  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length === 0) {
    showToast('Audio trek topilmadi.', 'warning');
    return;
  }

  isMicEnabled = !isMicEnabled;
  audioTracks.forEach(track => {
    track.enabled = isMicEnabled;
  });

  updateTrackIndicators();
  updateMediaButtonStates();

  if (isMicEnabled) {
    showToast('Mikrofon yoqildi.', 'info');
    log('Mikrofon yoqildi.', 'info');
  } else {
    showToast('Mikrofon o\'chirildi (Mute).', 'warning');
    log('Mikrofon o\'chirildi (Mute).', 'warning');
  }
}

/**
 * Kamerani yoqish / o'chirish
 */
function toggleCamera() {
  if (!localStream) {
    showToast('Avval kamerani va mikrofonni yoqing!', 'warning');
    return;
  }

  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length === 0) {
    showToast('Video trek topilmadi.', 'warning');
    return;
  }

  isCamEnabled = !isCamEnabled;
  videoTracks.forEach(track => {
    track.enabled = isCamEnabled;
  });

  localPlaceholder.style.display = isCamEnabled ? 'none' : 'flex';
  updateTrackIndicators();
  updateMediaButtonStates();

  if (isCamEnabled) {
    showToast('Kamera yoqildi.', 'info');
    log('Kamera yoqildi.', 'info');
  } else {
    showToast('Kamera o\'chirildi.', 'warning');
    log('Kamera o\'chirildi.', 'warning');
  }
}

/**
 * Tugmalar va indikatorlarning UI holatini yangilash
 */
function updateTrackIndicators() {
  if (isMicEnabled) {
    localMicIndicator.className = 'track-ind track-active';
    localMicIndicator.title = 'Mikrofon faol';
  } else {
    localMicIndicator.className = 'track-ind track-muted';
    localMicIndicator.title = 'Mikrofon o\'chirilgan';
  }

  if (isCamEnabled) {
    localCamIndicator.className = 'track-ind track-active';
    localCamIndicator.title = 'Kamera faol';
  } else {
    localCamIndicator.className = 'track-ind track-muted';
    localCamIndicator.title = 'Kamera o\'chirilgan';
  }
}

function updateMediaButtonStates() {
  if (isMicEnabled) {
    btnToggleMic.classList.remove('is-muted');
    lblToggleMic.textContent = 'Mic ON';
  } else {
    btnToggleMic.classList.add('is-muted');
    lblToggleMic.textContent = 'Mic OFF';
  }

  if (isCamEnabled) {
    btnToggleCam.classList.remove('is-muted');
    lblToggleCam.textContent = 'Camera ON';
  } else {
    btnToggleCam.classList.add('is-muted');
    lblToggleCam.textContent = 'Camera OFF';
  }
}

// Media tugmalari eshituvchilari
btnStartMedia.addEventListener('click', async () => {
  try {
    await ensureLocalMediaStream();
  } catch (err) {
    // Already handled in ensureLocalMediaStream
  }
});
btnToggleMic.addEventListener('click', toggleMicrophone);
btnToggleCam.addEventListener('click', toggleCamera);

// To'liq ekranga o'tkazish
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    remoteVideoContainer.requestFullscreen().catch(err => {
      showToast(`To'liq ekranga o'tishda xatolik: ${err.message}`, 'error');
    });
  } else {
    document.exitFullscreen();
  }
});

// ============================================================
// 7. RTCPeerConnection va ICE Boshqaruvi
// ============================================================

/**
 * Mavjud PeerConnection resurslarini to'liq tozalash (Xotira sizib chiqishini oldini oladi)
 */
function cleanUpPeerConnection() {
  if (peerConnection) {
    log('Eski RTCPeerConnection yopilmoqda va barcha resurslari tozalanmoqda...', 'info');

    // Hodisa tinglovchilarini olib tashlash
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;

    if (peerConnection.signalingState !== 'closed') {
      peerConnection.close();
    }
    peerConnection = null;
    log('Eski RTCPeerConnection resurslari to\'liq tozalandi.', 'info');
  }
}

/**
 * PeerConnection obyektini yaratish va uning hodisalarini sozlash
 */
function createPeerConnectionInstance() {
  // Takroriy ulanishlarning oldini olish va eski resurslarni tozalash
  cleanUpPeerConnection();

  log('Yangi RTCPeerConnection yaratilmoqda...', 'info');
  peerConnection = new RTCPeerConnection(configuration);

  // Masofaviy oqim qabul qilinganda
  peerConnection.ontrack = (event) => {
    log(`Masofaviy trek qabul qilindi: ${event.track.kind}`, 'success');
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      remoteStream = event.streams[0];
    } else {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
    }
    remotePlaceholder.style.display = 'none';
  };

  // ICE nomzodlar holatini kuzatish
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      log(`ICE nomzod topildi: ${event.candidate.type} (${event.candidate.protocol} ${event.candidate.address || event.candidate.relatedAddress || ''})`, 'info');
    } else {
      log('ICE nomzodlar yig\'ilishi to\'liq yakunlandi (null candidate).', 'success');
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    const state = peerConnection ? peerConnection.iceGatheringState : 'closed';
    log(`ICE Gathering holati o'zgardi: ${state}`, 'info');
    updateIceStatus(state);
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (!peerConnection) return;
    const iceState = peerConnection.iceConnectionState;
    log(`ICE Connection holati: ${iceState}`, 'info');
    if (iceState === 'connected' || iceState === 'completed') {
      updateConnectionStatus('connected');
      showToast('P2P ICE ulanishi muvaffaqiyatli o\'rnatildi!', 'success');
    } else if (iceState === 'failed') {
      updateConnectionStatus('failed');
      showToast('ICE ulanishi amalga oshmadi. Tarmoq yoki xavfsizlik devori bloklagan bo\'lishi mumkin.', 'error');
    } else if (iceState === 'disconnected') {
      updateConnectionStatus('disconnected');
      showToast('Masofadagi foydalanuvchi bilan aloqa uzildi.', 'warning');
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (!peerConnection) return;
    const connState = peerConnection.connectionState;
    log(`PeerConnection holati: ${connState}`, 'info');
    updateConnectionStatus(connState);

    if (connState === 'connected') {
      showToast('P2P Videoaloqa faol!', 'success');
    } else if (connState === 'disconnected') {
      showToast('Aloqa vaqtincha uzildi...', 'warning');
    } else if (connState === 'failed') {
      showToast('Ulanish xatolik bilan tugadi.', 'error');
    } else if (connState === 'closed') {
      showToast('Ulanish yopildi.', 'info');
    }
  };

  peerConnection.onsignalingstatechange = () => {
    if (peerConnection) {
      log(`Signaling holati: ${peerConnection.signalingState}`, 'info');
    }
  };

  // Agar localStream allaqachon mavjud bo'lsa, treklarni qo'shish
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      log(`Mahalliy ${track.kind} treki PeerConnection ga qo'shildi`, 'info');
    });
  }

  return peerConnection;
}

/**
 * Ulanish holati indikatorlarini yangilash
 */
function updateConnectionStatus(state) {
  connectionStatusBadge.className = 'status-pill';

  switch (state) {
    case 'connected':
    case 'completed':
      connectionStatusBadge.classList.add('status-connected');
      connectionStatusText.textContent = 'Ulanish: Ulangan';
      break;
    case 'connecting':
    case 'checking':
      connectionStatusBadge.classList.add('status-connecting');
      connectionStatusText.textContent = 'Ulanish: Ulanmoqda...';
      break;
    case 'disconnected':
      connectionStatusBadge.classList.add('status-disconnected');
      connectionStatusText.textContent = 'Ulanish: Uzildi';
      break;
    case 'failed':
      connectionStatusBadge.classList.add('status-failed');
      connectionStatusText.textContent = 'Ulanish: Xatolik';
      break;
    case 'closed':
      connectionStatusBadge.classList.add('status-idle');
      connectionStatusText.textContent = 'Ulanish: Yopildi';
      break;
    default:
      connectionStatusBadge.classList.add('status-idle');
      connectionStatusText.textContent = 'Ulanish: Kutilmoqda';
  }
}

/**
 * ICE holati indikatorini yangilash
 */
function updateIceStatus(state) {
  iceStatusBadge.className = 'status-pill';

  switch (state) {
    case 'gathering':
      iceStatusBadge.classList.add('status-ice-gathering');
      iceStatusText.textContent = 'ICE: Yig\'ilmoqda...';
      break;
    case 'complete':
      iceStatusBadge.classList.add('status-ice-complete');
      iceStatusText.textContent = 'ICE: To\'liq jamlandi';
      break;
    default:
      iceStatusBadge.classList.add('status-ice-idle');
      iceStatusText.textContent = 'ICE: Boshlanmagan';
  }
}

/**
 * ICE nomzodlar to'liq yig'ilishini kutuvchi Promise (Texnik audit talabi 2 ga binoan):
 * - ICE gathering complete bo'lmasdan SDP eksport qilishga mutlaqo ruxsat bermaydi!
 * - 15 soniyalik timeout tugasa, to'liq bo'lmagan SDP ni qabul qilmaydi, aksincha xatolik bilan reject qiladi.
 * - Qayta urinish imkoniyatini ta'minlaydi.
 */
function waitForAllIceCandidates(pc, maxWaitMs = 15000) {
  return new Promise((resolve, reject) => {
    // Agar allaqachon to'liq bo'lsa
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    showIceProgressBar(true, 'ICE nomzodlar STUN serverdan to‘liq yig‘ilmoqda...');
    let isSettled = false;
    let timer = null;

    const cleanup = () => {
      pc.removeEventListener('icegatheringstatechange', stateChangeHandler);
      pc.removeEventListener('icecandidate', candidateHandler);
      if (timer) clearTimeout(timer);
      showIceProgressBar(false);
    };

    const stateChangeHandler = () => {
      if (!isSettled && pc.iceGatheringState === 'complete') {
        isSettled = true;
        cleanup();
        log('ICE nomzodlar to‘liq yig‘ildi (iceGatheringState: complete).', 'success');
        resolve();
      }
    };

    const candidateHandler = (event) => {
      // event.candidate null bo'lishi brauzer barcha nomzodlarni jamlaganini bildiradi
      if (!isSettled && !event.candidate) {
        isSettled = true;
        cleanup();
        log('ICE nomzodlar yig‘ilishi yakunlandi (null candidate keldi).', 'success');
        resolve();
      }
    };

    // Timeout himoyasi: STUN javob bermasa to'liq bo'lmagan SDP ni EKSport qilmeymiz, xatolik beramiz!
    timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        const timeoutErr = new Error('ICE nomzodlarni to‘liq yig‘ish vaqti tugadi (Google STUN javob bermadi yoki tarmoq bloklangan). To‘liq bo‘lmagan SDP eksport qilinmadi.');
        log(timeoutErr.message, 'error');
        reject(timeoutErr);
      }
    }, maxWaitMs);

    pc.addEventListener('icegatheringstatechange', stateChangeHandler);
    pc.addEventListener('icecandidate', candidateHandler);
  });
}

function showIceProgressBar(show, message = '') {
  if (show) {
    iceProgressContainer.style.display = 'flex';
    iceProgressMessage.textContent = message;
  } else {
    iceProgressContainer.style.display = 'none';
  }
}

// ============================================================
// 8. 1-Foydalanuvchi Oqimi (Offer Yaratish & Answer Qabul Qilish)
// ============================================================

/**
 * 1. Create Offer
 */
btnCreateOffer.addEventListener('click', async () => {
  try {
    btnCreateOffer.disabled = true;
    btnCreateOffer.innerHTML = '<span class="ice-spinner"></span> Offer yaratilmoqda...';

    // 1. Kamera va mikrofonni tekshirish
    await ensureLocalMediaStream();

    // 2. PeerConnection yaratish (eski ulanishni tozalagan holda)
    createPeerConnectionInstance();
    isOffererFlow = true;

    // 3. Offer yaratish
    log('SDP Offer yaratilmoqda...', 'info');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    // 4. Local Description o'rnatish
    await peerConnection.setLocalDescription(offer);
    log('Local Description sifatida Offer o\'rnatildi. ICE yig\'ish boshlandi...', 'info');

    // 5. ICE yig'ilishi to'liq tugashini kutish (Talab 2: faqat to'liq bo'lgandagina davom etadi)
    await waitForAllIceCandidates(peerConnection);

    // 6. To'liq standart raw SDP matnini saqlash (Talab 3)
    generatedOfferSdp = peerConnection.localDescription.sdp;

    // Tekshirish: SDP da nomzodlar borligini tasdiqlash
    if (generatedOfferSdp.includes('a=candidate')) {
      log('SDP tarkibida ICE nomzodlar mavjudligi tasdiqlandi.', 'success');
    } else {
      log('Diqqat: SDP tarkibida a=candidate topilmadi. STUN ulanishini tekshiring.', 'warning');
    }

    // SDP ko'rinishini inspectorga yozish (Standart raw SDP matni)
    sdpTextArea.value = generatedOfferSdp;
    sdpTypeLabel.textContent = 'SDP Offer (Standart Matn - Tayyor)';

    // UI qadamlarini yangilash
    stepCreateOffer.classList.remove('active');
    stepCreateOffer.classList.add('completed');
    btnCreateOffer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Offer Tayyor!';

    stepDownloadOffer.classList.add('active');
    btnDownloadOffer.disabled = false;

    showToast('Offer tayyor! Endi "Download Offer" tugmasini bosing.', 'success');
    log('SDP Offer to\'liq tayyor bo\'ldi va yuklab olishga ruxsat berildi.', 'success');

    // Avtomatik yuklab olishni boshlash (standart raw SDP matni)
    downloadFile(generatedOfferSdp, 'offer.sdp');
  } catch (error) {
    // Qayta urinish imkoniyatini ta'minlash (Talab 2)
    cleanUpPeerConnection();
    generatedOfferSdp = null;

    btnCreateOffer.disabled = false;
    btnCreateOffer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg> Qayta urinish (Create Offer)';

    stepCreateOffer.className = 'step-item active';
    stepDownloadOffer.className = 'step-item';
    btnDownloadOffer.disabled = true;

    log(`Offer yaratishda xatolik: ${error.message}`, 'error');
    showToast(`Xatolik: ${error.message}. Qayta urinib ko'ring.`, 'error', 6000);
  }
});

/**
 * 2. Download Offer (.sdp fayl - Standart SDP Matni)
 */
btnDownloadOffer.addEventListener('click', () => {
  if (!generatedOfferSdp) {
    showToast('Avval Offer yarating!', 'warning');
    return;
  }

  // Standart raw SDP matni sifatida saqlash
  downloadFile(generatedOfferSdp, 'offer.sdp');

  stepDownloadOffer.classList.remove('active');
  stepDownloadOffer.classList.add('completed');

  stepUploadAnswer.classList.add('active');
  btnUploadAnswer.disabled = false;

  showToast('offer.sdp yuklab olindi! Uni 2-foydalanuvchiga yuboring.', 'info');
  log('offer.sdp fayli yuklab olindi. 2-foydalanuvchi javobi kutilmoqda.', 'info');
});

/**
 * 3. Upload Answer (.sdp fayl)
 */
btnUploadAnswer.addEventListener('click', () => {
  fileInputAnswer.click();
});

fileInputAnswer.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    log(`Answer fayli o'qilmoqda: ${file.name}`, 'info');
    const content = await readFileAsText(file);
    const parsed = parseSdpContent(content, 'answer');

    if (!peerConnection) {
      throw new Error('PeerConnection mavjud emas. Avval 1-qadamda Offer yaratgan bo\'lishingiz shart.');
    }

    if (peerConnection.signalingState !== 'have-local-offer') {
      log(`Kutilmagan signaling holati: ${peerConnection.signalingState}. "have-local-offer" kutilgan edi.`, 'warning');
    }

    log('Remote Description sifatida Answer o\'rnatilmoqda...', 'info');
    await peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: parsed.sdp
    }));

    stepUploadAnswer.classList.remove('active');
    stepUploadAnswer.classList.add('completed');
    btnUploadAnswer.disabled = true;
    btnUploadAnswer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Answer Qabul Qilindi!';

    sdpTextArea.value = parsed.sdp;
    sdpTypeLabel.textContent = 'SDP Answer (Masofaviy - O\'rnatildi)';

    log('Answer muvaffaqiyatli o\'rnatildi! P2P to\'g\'ridan-to\'g\'ri aloqa boshlanmoqda...', 'success');
    showToast('Answer qabul qilindi! P2P ulanish o‘rnatilmoqda...', 'success');
  } catch (error) {
    log(`Answer yuklashda xatolik: ${error.message}`, 'error');
    showToast(`Xatolik: ${error.message}`, 'error', 6000);
  } finally {
    event.target.value = '';
  }
});

// ============================================================
// 9. 2-Foydalanuvchi Oqimi (Offer Qabul Qilish & Answer Yaratish)
// ============================================================

/**
 * 1. Upload Offer (.sdp fayl)
 */
btnUploadOffer.addEventListener('click', () => {
  fileInputOffer.click();
});

fileInputOffer.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    log(`Offer fayli o'qilmoqda: ${file.name}`, 'info');
    const content = await readFileAsText(file);
    const parsed = parseSdpContent(content, 'offer');

    // 1. Kamera va mikrofonni faollashtirish
    await ensureLocalMediaStream();

    // 2. PeerConnection tayyorlash (eski ulanish tozalanadi)
    createPeerConnectionInstance();
    isAnswererFlow = true;

    // 3. Remote Description ga Offer o'rnatish
    log('Remote Description sifatida kelgan Offer o\'rnatilmoqda...', 'info');
    await peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: parsed.sdp
    }));

    stepUploadOffer.classList.remove('active');
    stepUploadOffer.classList.add('completed');
    btnUploadOffer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Offer Qabul Qilindi!';

    stepCreateAnswer.classList.add('active');
    btnCreateAnswer.disabled = false;

    sdpTextArea.value = parsed.sdp;
    sdpTypeLabel.textContent = 'SDP Offer (Masofaviy - Qabul qilindi)';

    log('Offer qabul qilindi va Remote Description o\'rnatildi. Endi "Create Answer" tugmasini bosing.', 'success');
    showToast('Offer fayli qabul qilindi! Endi "Create Answer" tugmasini bosing.', 'success');
  } catch (error) {
    log(`Offer faylini yuklashda xatolik: ${error.message}`, 'error');
    showToast(`Offer xatosi: ${error.message}`, 'error', 6000);
  } finally {
    event.target.value = '';
  }
});

/**
 * 2. Create Answer
 */
btnCreateAnswer.addEventListener('click', async () => {
  try {
    if (!peerConnection || peerConnection.signalingState !== 'have-remote-offer') {
      throw new Error('Avval 1-foydalanuvchining offer.sdp faylini yuklashingiz shart!');
    }

    btnCreateAnswer.disabled = true;
    btnCreateAnswer.innerHTML = '<span class="ice-spinner"></span> Answer yaratilmoqda...';

    // 1. Answer yaratish
    log('SDP Answer yaratilmoqda...', 'info');
    const answer = await peerConnection.createAnswer();

    // 2. Local Description ga Answer o'rnatish
    await peerConnection.setLocalDescription(answer);
    log('Local Description sifatida Answer o\'rnatildi. ICE yig\'ish boshlandi...', 'info');

    // 3. ICE nomzodlar to'liq yig'ilishini kutish (Talab 2: to'liq bo'lmaguncha ruxsat bermaydi)
    await waitForAllIceCandidates(peerConnection);

    // 4. To'liq Answer raw SDP ni saqlash (Talab 3)
    generatedAnswerSdp = peerConnection.localDescription.sdp;

    sdpTextArea.value = generatedAnswerSdp;
    sdpTypeLabel.textContent = 'SDP Answer (Standart Matn - Tayyor)';

    stepCreateAnswer.classList.remove('active');
    stepCreateAnswer.classList.add('completed');
    btnCreateAnswer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Answer Tayyor!';

    stepDownloadAnswer.classList.add('active');
    btnDownloadAnswer.disabled = false;

    showToast('Answer tayyor! Uni yuklab oling va 1-foydalanuvchiga yuboring.', 'success');
    log('SDP Answer to\'liq tayyor bo\'ldi va eksportga ruxsat berildi.', 'success');

    // Avtomatik yuklab olish (standart raw SDP matni)
    downloadFile(generatedAnswerSdp, 'answer.sdp');
  } catch (error) {
    // Qayta urinish imkoniyatini ta'minlash (Talab 2)
    generatedAnswerSdp = null;

    btnCreateAnswer.disabled = false;
    btnCreateAnswer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg> Qayta urinish (Create Answer)';

    stepCreateAnswer.className = 'step-item active';
    stepDownloadAnswer.className = 'step-item';
    btnDownloadAnswer.disabled = true;

    log(`Answer yaratishda xatolik: ${error.message}`, 'error');
    showToast(`Answer yaratishda xatolik: ${error.message}. Qayta urinib ko'ring.`, 'error', 6000);
  }
});

/**
 * 3. Download Answer (.sdp fayl - Standart SDP Matni)
 */
btnDownloadAnswer.addEventListener('click', () => {
  if (!generatedAnswerSdp) {
    showToast('Avval Answer yarating!', 'warning');
    return;
  }

  // Standart raw SDP matni sifatida saqlash
  downloadFile(generatedAnswerSdp, 'answer.sdp');

  stepDownloadAnswer.classList.remove('active');
  stepDownloadAnswer.classList.add('completed');

  showToast('answer.sdp yuklab olindi! Uni 1-foydalanuvchiga yuboring.', 'info');
  log('answer.sdp yuklab olindi. 1-foydalanuvchi yuklagach ulanish hosil bo\'ladi.', 'info');
});

// ============================================================
// 10. SDP Fayllarini Xavfsiz Tekshirish va Saqlash (Talab 3 & 4)
// ============================================================

/**
 * Faylni matn sifatida o'qish
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Faylni o\'qib bo\'lmadi.'));
    reader.readAsText(file);
  });
}

/**
 * SDP tarkibini xavfsiz tahlil qilish va validatsiya (Talab 3):
 * - Standart raw SDP matnini to'g'ri qabul qiladi.
 * - JSON formatida bo'lsa ham qo'llab-quvvatlaydi.
 * - Offer va Answer turlarini aniq ajratadi (a=setup:actpass vs a=setup:active/passive).
 * - Noto'g'ri fayllarni rad etadi.
 */
function parseSdpContent(rawText, expectedType) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    throw new Error('Yuklangan fayl bo‘sh yoki yaroqsiz formatda.');
  }

  const trimmed = rawText.trim();
  let parsedSdp = null;
  let explicitType = null;

  // 1-variant: JSON format (avvalgi versiyalar bilan orqaga moslik uchun)
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.sdp === 'string') {
      parsedSdp = obj.sdp.trim();
      explicitType = obj.type ? obj.type.toLowerCase() : null;
    }
  } catch (e) {
    // JSON emas, demak standart xom SDP matni
  }

  // 2-variant: Standart raw SDP matni
  if (!parsedSdp) {
    parsedSdp = trimmed;
  }

  // SDP qatorlarini RFC formatiga keltirish.
  // Ayrim uzatish/yuklash jarayonlarida LF saqlanib qoladi;
  // Chrome uchun barcha SDP qatorlarini CRLF ko‘rinishiga normallashtiramiz.
  parsedSdp = parsedSdp
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r|\n/g, '\r\n');

  // SDP strukturaviy tekshiruvlari
  const hasV = parsedSdp.startsWith('v=0') || parsedSdp.includes('\nv=0') || parsedSdp.includes('\r\nv=0');
  if (!hasV) {
    throw new Error('Yaroqsiz SDP fayl! Standart "v=0" sarlavhasi topilmadi.');
  }

  if (!parsedSdp.includes('s=') || !parsedSdp.includes('t=')) {
    throw new Error('Yaroqsiz SDP fayl! Majburiy SDP sessiya maydonlari (s=, t=) yetishmaydi.');
  }

  if (!parsedSdp.includes('m=audio') && !parsedSdp.includes('m=video')) {
    throw new Error('Yaroqsiz SDP fayl! Hech qanday media oqimi (m=audio yoki m=video) topilmadi.');
  }

  // WebRTC da Offer va Answer turini avtomatik va aniq aniqlash:
  // - Har qanday WebRTC Offer: har doim "a=setup:actpass" ga ega bo'ladi (RFC 4145 / 8842).
  // - Har qanday WebRTC Answer: "a=setup:active" yoki "a=setup:passive" ga ega bo'lib, "actpass" bo'lmaydi.
  let detectedType = explicitType;
  if (!detectedType) {
    if (parsedSdp.includes('a=setup:actpass')) {
      detectedType = 'offer';
    } else if (parsedSdp.includes('a=setup:active') || parsedSdp.includes('a=setup:passive')) {
      detectedType = 'answer';
    } else {
      detectedType = expectedType;
    }
  }

  // Tur mosligini qat'iy tekshirish
  if (expectedType && detectedType) {
    if (expectedType === 'offer' && detectedType === 'answer') {
      throw new Error('Siz Answer (.sdp) faylini yukladingiz! Bu yerga 1-foydalanuvchining Offer (.sdp) fayli yuklanishi kerak.');
    }
    if (expectedType === 'answer' && detectedType === 'offer') {
      throw new Error('Siz Offer (.sdp) faylini yukladingiz! Bu yerga 2-foydalanuvchining Answer (.sdp) fayli yuklanishi kerak.');
    }
  }

  // ICE nomzodlar mavjudligini tekshirish
  if (!parsedSdp.includes('a=candidate')) {
    log('Ogohlantirish: Yuklangan SDP faylida a=candidate qatorlari topilmadi. Signaling serversiz to‘g‘ridan-to‘g‘ri ulanish sekinlashishi mumkin.', 'warning');
  }

  return {
    type: detectedType || expectedType,
    sdp: parsedSdp
  };
}

/**
 * Faylni brauzer orqali xavfsiz yuklab olish (Talab 4):
 * Blob URL darhol bekor qilinmaydi (revokeObjectURL kechiktiriladi),
 * natijada fayl to'liq va uzilishlarsiz yuklab olinadi.
 */
function downloadFile(content, filename) {
  try {
    const blob = new Blob([content], { type: 'application/sdp;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Muhim tuzatish: URL.revokeObjectURL(url) ni darhol chaqirmaslik kerak!
    // Brauzer faylni to'liq yuklab olishi uchun 2 soniya kechiktirib tozalanadi.
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 2000);

    log(`${filename} fayli yuklab olish uchun saqlandi.`, 'success');
  } catch (err) {
    log(`Faylni yuklab olishda xatolik: ${err.message}`, 'error');
    showToast(`Faylni saqlashda xatolik: ${err.message}`, 'error');
  }
}

// ============================================================
// 11. Qo'ng'iroqni Yakunlash (Disconnect) & Barcha Media Treklarni To'xtatish
// ============================================================

/**
 * Qo'ng'iroqni to'xtatish:
 * - PeerConnection yopiladi va resurslari tozalanadi
 * - Barcha mahalliy va masofaviy media treklar to'xtatiladi
 * - Video elementlar tozalanadi
 * - Barcha tugmalar va indikatorlar dastlabki holatga qaytariladi
 */
function disconnectCall() {
  log('Qo\'ng\'iroq yakunlanmoqda...', 'warning');

  // 1. Mahalliy media treklarni to'xtatish
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
      log(`Mahalliy trek to'xtatildi: ${track.kind}`, 'info');
    });
    localStream = null;
  }

  // 2. Masofaviy treklarni to'xtatish
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => {
      track.stop();
    });
    remoteStream = null;
  }

  // 3. PeerConnection ni yopish va tozalash
  cleanUpPeerConnection();

  // 4. Video elementlarini tozalash
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  remotePlaceholder.style.display = 'flex';
  localPlaceholder.style.display = 'flex';

  // 5. O'zgaruvchilarni qayta tiklash
  generatedOfferSdp = null;
  generatedAnswerSdp = null;
  isOffererFlow = false;
  isAnswererFlow = false;
  isMicEnabled = true;
  isCamEnabled = true;

  // 6. UI holatini qayta tiklash
  updateConnectionStatus('closed');
  updateIceStatus('idle');
  updateMediaButtonStates();
  updateTrackIndicators();
  showIceProgressBar(false);

  // Offerer UI reset
  stepCreateOffer.className = 'step-item active';
  btnCreateOffer.disabled = false;
  btnCreateOffer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Create Offer';

  stepDownloadOffer.className = 'step-item';
  btnDownloadOffer.disabled = true;

  stepUploadAnswer.className = 'step-item';
  btnUploadAnswer.disabled = true;
  btnUploadAnswer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Upload Answer';

  // Answerer UI reset
  stepUploadOffer.className = 'step-item active';
  btnUploadOffer.disabled = false;
  btnUploadOffer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Upload Offer';

  stepCreateAnswer.className = 'step-item';
  btnCreateAnswer.disabled = true;
  btnCreateAnswer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Create Answer';

  stepDownloadAnswer.className = 'step-item';
  btnDownloadAnswer.disabled = true;

  sdpTextArea.value = '';
  sdpTypeLabel.textContent = 'SDP Ma\'lumotlari (Bo\'sh)';

  log('Barcha resurslar tozalandi va tizim boshlang\'ich holatga qaytdi.', 'info');
  showToast('Qo\'ng\'iroq yakunlandi. Barcha kamera va audio treklar to\'xtatildi.', 'info');
}

btnDisconnect.addEventListener('click', disconnectCall);
