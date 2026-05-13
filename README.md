# 🔍 Smart Object Detection & Recognition

An AI-powered real-time object detection web application that uses **YOLOv8** to detect objects through your webcam, draws bounding boxes on a live canvas overlay, and announces detected objects via the browser's **speech synthesis** API. Built with a Flask REST API backend and a vanilla HTML/CSS/JS frontend, deployed on **Render** (backend) and **Vercel** (frontend).

---

## 🌐 Live Demo

| Service  | URL |
|----------|-----|
| Frontend | Deployed on [Vercel](https://vercel.com) |
| Backend  | `https://object-detection-and-recognition.onrender.com` |

---

## ✨ Features

- 🎥 **Live Webcam Detection** — Captures frames from the browser webcam every 1.5 seconds and sends them to the backend for inference.
- 🤖 **YOLOv8 Inference** — Runs `yolov8n` (nano) model for fast, accurate real-time object detection.
- 🖼️ **Bounding Box Overlay** — Detected objects are highlighted with green bounding boxes and confidence labels on a canvas overlay.
- 🔊 **Voice Announcements** — Uses the Web Speech API (`SpeechSynthesisUtterance`) to announce the most confident detected object aloud. Prevents repetitive announcements with a 4-second cooldown.
- 📊 **Detection History** — All detections are logged to a SQLite database. A "Predictions" table shows the last 50 detected objects with confidence and timestamp.
- 🔐 **User Authentication** — Register and login functionality backed by SQLite user storage.
- 💾 **Persistent Login** — User session is persisted via `localStorage` across browser refreshes.
- ❤️ **Health Check Ping** — Frontend silently pings the backend on page load to wake it from Render's free-tier cold start.
- 🌍 **CORS Configured** — Full CORS support with `flask-cors` and explicit header injection on every response, including preflight `OPTIONS` requests.

---

## 🗂️ Project Structure

```
object_dec/
├── backend/
│   ├── app.py                # Flask API: auth, detection, predictions endpoints
│   ├── requirements.txt      # Python dependencies
│   ├── yolov8n.pt            # YOLOv8 nano pre-trained model weights (not in git)
│   ├── database.db           # SQLite database (not in git)
│   └── .env                  # Environment variables (not in git)
│
├── frontend/
│   ├── index.html            # Single-page application shell (Login / Register / Dashboard)
│   ├── vercel.json           # Vercel SPA routing config
│   └── static/
│       ├── css/
│       │   └── style.css     # Custom glassmorphism UI styles
│       └── js/
│           └── main.js       # All frontend logic: auth, camera, detection, speech
│
├── render.yaml               # Render deployment configuration
├── .gitignore                # Excludes .env, .venv, *.pt, *.db, etc.
└── README.md
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Python 3.10 | Runtime |
| Flask | REST API framework |
| flask-cors | Cross-Origin Resource Sharing |
| Ultralytics YOLOv8 | Object detection model |
| OpenCV (`opencv-python-headless`) | Image decoding from base64 |
| NumPy | Array operations for image processing |
| SQLite | Lightweight database for users & detections |
| Gunicorn | Production WSGI server |
| python-dotenv | Environment variable loading |

### Frontend
| Technology | Purpose |
|-----------|---------|
| HTML5 / Vanilla JS | SPA shell and logic |
| Bootstrap 5.3 | Responsive layout and components |
| Font Awesome 6.4 | Icons |
| Google Fonts (Inter) | Typography |
| Web Speech API | Voice announcements |
| Canvas API | Bounding box overlay rendering |
| Fetch API | Communication with the backend |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- pip
- A modern browser with webcam access

---

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/YASHASHRIKADU/Object-Detection-And-Recognition.git
cd Object-Detection-And-Recognition/backend

# 2. Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create the .env file
echo FLASK_SECRET_KEY=your_secret_key_here > .env

# 5. Download the YOLOv8 nano model weights
#    (Ultralytics will auto-download on first run, or place yolov8n.pt manually)

# 6. Run the development server
python app.py
```

The backend will be available at `http://localhost:5000`.

---

### Frontend Setup

The frontend is fully static — no build step required.

```bash
# Option A: Serve with Python's built-in server
cd frontend
python -m http.server 8080
# Then open http://localhost:8080
```

> **Note:** For local development, update the `API_URL` constant in `frontend/static/js/main.js` to point to your local backend:
> ```js
> const API_URL = "http://localhost:5000/api";
> ```

---

## 📡 API Reference

All API routes are prefixed with `/api`.

### `GET /health` or `GET /api/health`
Health check endpoint. Returns `{"status": "ok"}`. Used by the frontend to wake the Render instance on page load.

---

### `POST /api/register`
Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret"
}
```

**Response:**
```json
{ "success": true, "message": "Registration successful" }
```

---

### `POST /api/login`
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "secret"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { "id": 1, "name": "John Doe", "email": "john@example.com" }
}
```

---

### `POST /api/detect`
Run YOLOv8 object detection on a single frame.

**Request Body:**
```json
{
  "image": "<base64-encoded JPEG data URL>"
}
```

**Response:**
```json
{
  "success": true,
  "detections": [
    {
      "label": "person",
      "confidence": 0.91,
      "box": [120, 45, 380, 410]
    }
  ]
}
```

Each detection is also saved to the `detections` table in the SQLite database.

---

### `GET /api/predictions`
Fetch the last 50 stored detections (most recent first).

**Response:**
```json
[
  {
    "id": 42,
    "object_name": "person",
    "confidence": 0.91,
    "detected_time": "2026-05-13 08:30:00.123456"
  }
]
```

---

## 🗄️ Database Schema

```sql
-- Users table
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    email         TEXT,
    password      TEXT
);

-- Detections table
CREATE TABLE detections (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    object_name   TEXT,
    confidence    REAL,
    detected_time TEXT
);
```

> ⚠️ Passwords are currently stored in plain text. For production use, replace with a hashed approach using `bcrypt` or `werkzeug.security`.

---

## ☁️ Deployment

### Backend → Render

The `render.yaml` file at the project root configures automatic deployment:

```yaml
services:
  - type: web
    name: object-detection-api
    env: python
    buildCommand: "pip install -r backend/requirements.txt"
    startCommand: "cd backend && gunicorn app:app --bind 0.0.0.0:$PORT"
    envVars:
      - key: FLASK_SECRET_KEY
        generateValue: true
      - key: PYTHON_VERSION
        value: 3.10.0
```

> **Note:** The `yolov8n.pt` model file is not committed to git (it's ~6.3 MB). Ultralytics will attempt to download it automatically on startup. If this fails on Render, commit the file manually or use a model stored in cloud storage.

---

### Frontend → Vercel

The `frontend/vercel.json` configures SPA routing so all paths serve `index.html`:

```json
{
  "version": 2,
  "public": true,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Deploy by connecting the `frontend/` directory to a new Vercel project, or push the repository and set the **Root Directory** to `frontend` in Vercel's project settings.

---

## 🔄 How Detection Works (Data Flow)

```
Browser Webcam
    │
    │  (every 1.5s)
    ▼
Canvas capture → base64 JPEG
    │
    │  POST /api/detect
    ▼
Flask Backend
    │
    ├─ Decode base64 → OpenCV image (NumPy array)
    ├─ Run YOLOv8 inference
    ├─ Extract: label, confidence, bounding box [x1,y1,x2,y2]
    ├─ Save detections to SQLite
    └─ Return detections JSON
    │
    ▼
Frontend JS
    ├─ Draw bounding boxes on canvas overlay
    └─ Speak most-confident label via Web Speech API
```

---

## 🖥️ UI Screens

| Screen | Description |
|--------|-------------|
| **Login** | Email + password sign-in form |
| **Register** | Create a new account |
| **Dashboard** | Two action cards: Start Detection or View Predictions |
| **Camera View** | Live webcam feed with bounding box overlay |
| **Predictions** | Table of last 50 detections from the database |

---

## ⚠️ Known Limitations

- **Cold Starts:** The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request may take up to 30 seconds. The frontend silently pings `/api/health` on page load to mitigate this.
- **Plain-text Passwords:** User passwords are stored without hashing. This is not suitable for production without adding a password hashing library.
- **Model on Disk:** The `yolov8n.pt` model file is not included in the repository. It must be present in the `backend/` directory before the server starts.
- **Single-user SQLite:** The app uses SQLite without connection pooling. For high-concurrency production workloads, migrate to PostgreSQL.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

## 🙋 Author

Maintained by the project owner. Contributions and issues are welcome via the repository.
