# 🚕 CabMatch — Cab Assignment System

A full-stack cab assignment system that automatically assigns the **nearest available driver** to a user requesting a ride, using **Euclidean distance** calculation.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite |
| **Backend** | Node.js + Express |
| **Database** | SQLite (via `sqlite3`) |
| **Styling** | Vanilla CSS (dark theme, glassmorphism) |
| **Distance Algorithm** | Euclidean — `√((x₂−x₁)² + (y₂−y₁)²)` |

---

## 📐 Distance Algorithm

The system uses **simple numeric Euclidean distance** — no maps, no GPS:

```
distance = √((driver.x − user.x)² + (driver.y − user.y)²)
```

All available drivers are compared and the one with the **minimum distance** is assigned instantly.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- npm

### 1. Backend

```bash
cd backend
npm install
npm start
```

Server runs at: **http://localhost:5000**

> On first run, 5 default drivers are auto-seeded into the database.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at: **http://localhost:5173**

---

## 🧩 Features

### 📊 Dashboard (Overview)
- **Driver Status panel** — lists all drivers with availability badge + visual progress bar
- **Live Grid Map** — canvas-based coordinate map showing all driver positions (green = available, red = busy)
- **Recent Activity Timeline** — last 10 ride events with colored timeline dots, assignment info, and distance
- **Ride summary stats** — Total, Completed, Active, No Driver, and Average Distance

### 👨‍✈️ Drivers Tab
- Add a new driver with name and (x, y) coordinates
- View all drivers — availability status, location
- Toggle driver between **Available** / **Busy**
- Delete a driver
- Full driver location map

### 🚗 Rides Tab
- Request a ride — enter your name and (x, y) location
- System finds and assigns the **nearest available driver** instantly
- Shows full **distance breakdown** — ranked list of all drivers and their distances
- **Live map** updates with your position as you type coordinates
- Complete active rides (returns driver to available pool)
- Full ride history with status badges

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drivers` | List all drivers |
| `POST` | `/api/drivers` | Add a new driver `{ name, x, y }` |
| `DELETE` | `/api/drivers/:id` | Remove a driver |
| `PATCH` | `/api/drivers/:id/toggle` | Toggle driver availability |
| `GET` | `/api/rides` | List all ride requests |
| `POST` | `/api/rides` | Request a ride — auto-assigns nearest driver `{ user_name, user_x, user_y }` |
| `POST` | `/api/rides/:id/complete` | Mark ride as completed (frees up driver) |
| `GET` | `/api/stats` | Dashboard statistics |

---

## 🗃️ Database Schema

```sql
CREATE TABLE drivers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  x           REAL    NOT NULL,
  y           REAL    NOT NULL,
  available   INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rides (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name   TEXT    NOT NULL,
  user_x      REAL    NOT NULL,
  user_y      REAL    NOT NULL,
  driver_id   INTEGER,
  driver_name TEXT,
  distance    REAL,
  status      TEXT DEFAULT 'pending',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
```

---

## 📁 Project Structure

```
cab-assignment-system/
├── backend/
│   ├── server.js          ← Express API + SQLite logic + distance calculation
│   ├── cab_system.db      ← SQLite database (auto-created on first run)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Full React app (tabs: Dashboard, Drivers, Rides)
│   │   ├── index.css      ← Dark theme design system
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── .gitignore
└── README.md
```

---

## ⚙️ Constraints Met

- ✅ Simple numeric distance — no maps or GPS used
- ✅ Only available drivers are considered for assignment
- ✅ Driver becomes unavailable once assigned; freed when ride is completed
- ✅ Ride is logged even if no driver is available (`no_driver_available` status)

---

## 👤 Author

**Ishwanku Saini**
Email: sainiishu30@gmail.com
