import os
import sqlite3
import datetime
import base64
import numpy as np
import cv2
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from ultralytics import YOLO

load_dotenv()

app = Flask(__name__)
# Enable CORS for all domains so Vercel frontend can access it
CORS(app, supports_credentials=True, origins="*")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "fallback_secret_key_if_env_missing")
DB = "database.db"

# Load YOLO model once at startup
model = YOLO("yolov8n.pt")

def get_db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db()
    cur = con.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        password TEXT
    )
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS detections(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        object_name TEXT,
        confidence REAL,
        detected_time TEXT
    )
    ''')
    con.commit()
    con.close()

init_db()

@app.route('/api/login', methods=['POST'])
def login_post():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT * FROM users WHERE email=? AND password=?", (email, password))
    user = cur.fetchone()

    if user:
        # Use simple response for frontend localStorage
        return jsonify({"success": True, "message": "Login successful", "user": dict(user)})
    else:
        return jsonify({"success": False, "message": "Invalid Login"}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Missing fields"}), 400

    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("INSERT INTO users(name,email,password) VALUES(?,?,?)", (name, email, password))
        con.commit()
        return jsonify({"success": True, "message": "Registration successful"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/predictions', methods=['GET'])
def view_predictions():
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT * FROM detections ORDER BY id DESC LIMIT 50")
    data = [dict(row) for row in cur.fetchall()]
    return jsonify(data)

@app.route('/api/detect', methods=['POST'])
def detect_objects():
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"error": "No image provided"}), 400

    # Image is expected to be a base64 encoded string
    img_data = data['image']
    if ',' in img_data:
        img_data = img_data.split(',')[1]

    try:
        img_bytes = base64.b64decode(img_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Failed to decode image"}), 400

        # Run YOLO detection
        results = model(frame)
        
        detections = []
        con = get_db()
        cur = con.cursor()
        now = str(datetime.datetime.now())

        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                detections.append({
                    "label": label,
                    "confidence": conf,
                    "box": [x1, y1, x2, y2]
                })

                # Save detection to database
                cur.execute(
                    "INSERT INTO detections(object_name,confidence,detected_time) VALUES(?,?,?)",
                    (label, conf, now)
                )
        
        con.commit()
        con.close()

        return jsonify({"success": True, "detections": detections})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
