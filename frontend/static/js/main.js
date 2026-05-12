/* BUILD v3 - Production API URL (Render) */
const API_URL = "https://object-detection-and-recognition.onrender.com/api";

// State
let currentUser = null;
let stream = null;
let detectionInterval = null;
let lastSpoken = "";
let lastSpokenTime = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Ping the backend to wake it from Render's free-tier cold start.
    // This runs silently in the background before the user clicks anything.
    fetch(`${API_URL}/health`).catch(() => {});

    // Check if logged in
    const storedUser = localStorage.getItem('user_name');
    if (storedUser) {
        currentUser = storedUser;
        document.getElementById('nav-user-name').innerText = currentUser;
        document.getElementById('dash-name').innerText = currentUser;
        document.getElementById('main-nav').style.display = 'block';
        showScreen('dashboard-screen');
    } else {
        showScreen('login-screen');
    }

    // Forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
});

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });
        const data = await res.json();
        if (data.success) {
            errorDiv.classList.add('d-none');
            currentUser = data.user.name;
            localStorage.setItem('user_name', currentUser);
            document.getElementById('nav-user-name').innerText = currentUser;
            document.getElementById('dash-name').innerText = currentUser;
            document.getElementById('main-nav').style.display = 'block';
            showScreen('dashboard-screen');
        } else {
            errorDiv.innerText = data.message;
            errorDiv.classList.remove('d-none');
        }
    } catch (err) {
        errorDiv.innerText = "Could not reach the server. It may be waking up — please wait 30 seconds and try again.";
        errorDiv.classList.remove('d-none');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, email, password})
        });
        const data = await res.json();
        if (data.success) {
            errorDiv.classList.add('d-none');
            alert("Registration successful! Please login.");
            showScreen('login-screen');
        } else {
            errorDiv.innerText = data.message;
            errorDiv.classList.remove('d-none');
        }
    } catch (err) {
        errorDiv.innerText = "Could not reach the server. It may be waking up — please wait 30 seconds and try again.";
        errorDiv.classList.remove('d-none');
    }
}

function logout() {
    localStorage.removeItem('user_name');
    currentUser = null;
    document.getElementById('main-nav').style.display = 'none';
    stopCamera();
    showScreen('login-screen');
}

async function viewPredictions() {
    showScreen('predictions-screen');
    const tbody = document.getElementById('predictions-table-body');
    tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Loading...</td></tr>";
    
    try {
        const res = await fetch(`${API_URL}/predictions`);
        const data = await res.json();
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' class='text-center'>No detections yet.</td></tr>";
        }
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td><span class="badge bg-primary">${row.object_name}</span></td>
                <td>${(row.confidence * 100).toFixed(1)}%</td>
                <td class="text-muted small">${row.detected_time}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>Error loading predictions.</td></tr>";
    }
}

// WebCam and Detection Logic
async function startCamera() {
    document.getElementById('dashboard-actions').classList.add('d-none');
    document.getElementById('camera-view').classList.remove('d-none');

    const video = document.getElementById('webcam');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            // Sync overlay canvas dimensions to the actual video resolution
            const overlay = document.getElementById('overlay');
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            // Start sending frames every 1.5s to avoid overloading the free-tier API
            detectionInterval = setInterval(sendFrameToAPI, 1500);
        };

        // Also re-sync overlay size whenever the video plays (handles autoplay timing)
        video.onplay = () => {
            const overlay = document.getElementById('overlay');
            overlay.width = video.videoWidth || 640;
            overlay.height = video.videoHeight || 480;
        };
    } catch (err) {
        alert("Camera access denied or error occurred.");
        stopCamera();
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    const overlay = document.getElementById('overlay');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    document.getElementById('camera-view').classList.add('d-none');
    document.getElementById('dashboard-actions').classList.remove('d-none');
}

function speak(text) {
    // Skip if same object was spoken within the last 4 seconds
    const now = Date.now();
    if (text === lastSpoken && now - lastSpokenTime < 4000) return;

    // Cancel any currently queued speech so new detections aren't silently swallowed
    window.speechSynthesis.cancel();

    const msg = new SpeechSynthesisUtterance(text + " detected");
    msg.rate = 1.0;
    msg.pitch = 1.0;
    msg.volume = 1.0;
    // Pick a clear English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) msg.voice = englishVoice;

    window.speechSynthesis.speak(msg);
    lastSpoken = text;
    lastSpokenTime = now;
}

async function sendFrameToAPI() {
    const video = document.getElementById('webcam');
    if (!video || !video.videoWidth) return;

    // Capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    try {
        const res = await fetch(`${API_URL}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });
        const data = await res.json();
        
        if (data.success && data.detections) {
            drawDetections(data.detections);
            if (data.detections.length > 0) {
                // Build a label combining all unique detected objects, speak most confident
                const uniqueLabels = [...new Set(data.detections.map(d => d.label))];
                const bestMatch = data.detections.reduce((prev, curr) =>
                    prev.confidence > curr.confidence ? prev : curr
                );
                // Announce the best match (most confident object)
                speak(bestMatch.label);
            } else {
                // Nothing detected — allow next object to be spoken immediately
                lastSpoken = "";
            }
        }
    } catch (err) {
        console.error("Detection error:", err);
    }
}

function drawDetections(detections) {
    const video = document.getElementById('webcam');
    const overlay = document.getElementById('overlay');

    // Keep overlay internal resolution in sync with the live video frame size
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
    }

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Scale factors: the canvas CSS size may differ from its internal pixel size
    const scaleX = overlay.offsetWidth / overlay.width;
    const scaleY = overlay.offsetHeight / overlay.height;

    ctx.save();
    ctx.scale(scaleX > 0 ? scaleX : 1, scaleY > 0 ? scaleY : 1);

    ctx.lineWidth = 2;
    ctx.font = "bold 16px Arial";

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;

        // Draw bounding box
        ctx.strokeStyle = "#00FF00";
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw label background for readability
        const text = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        const textY = y1 > 22 ? y1 - 6 : y2 + 16;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(x1, textY - 14, textWidth + 6, 18);

        // Draw label text
        ctx.fillStyle = "#00FF00";
        ctx.fillText(text, x1 + 3, textY);
    });

    ctx.restore();
}
