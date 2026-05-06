const API_URL = "http://localhost:5000/api"; // Change this to your Render URL in production (e.g., https://your-app.onrender.com/api)

// State
let currentUser = null;
let stream = null;
let detectionInterval = null;
let lastSpoken = "";
let lastSpokenTime = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
        errorDiv.innerText = "Failed to connect to API.";
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
        errorDiv.innerText = "Failed to connect to API.";
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
            const overlay = document.getElementById('overlay');
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            // Start sending frames
            detectionInterval = setInterval(sendFrameToAPI, 1000); // 1 FPS to avoid overloading the API
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
    const now = Date.now();
    if (text !== lastSpoken || now - lastSpokenTime > 3000) {
        const msg = new SpeechSynthesisUtterance(text + " detected");
        window.speechSynthesis.speak(msg);
        lastSpoken = text;
        lastSpokenTime = now;
    }
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
                // Speak the most confident object
                const bestMatch = data.detections.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current);
                speak(bestMatch.label);
            }
        }
    } catch (err) {
        console.error("Detection error:", err);
    }
}

function drawDetections(detections) {
    const overlay = document.getElementById('overlay');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    ctx.lineWidth = 2;
    ctx.font = "18px Arial";

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        ctx.strokeStyle = "#00FF00";
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        ctx.fillStyle = "#00FF00";
        const text = `${det.label} ${(det.confidence*100).toFixed(0)}%`;
        ctx.fillText(text, x1, y1 > 20 ? y1 - 5 : 20);
    });
}
