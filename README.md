# 🚕 Cab Assignment System

A full-stack system to assign the nearest available cab driver to users requesting rides.

## 🛠️ Tech Stack
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (via `sqlite3`)
- **Distance**: Euclidean (simple numeric, no maps)

## 🚀 Getting Started

### 1. Backend

```bash
cd backend
npm install
npm start
```

Server runs at: `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at: `http://localhost:5173`

## 🔧 Features

| Feature | Description |
|---|---|
| **Add Drivers** | Add drivers with name and (x, y) coordinates |
| **Request Ride** | Enter your location → system finds nearest available driver |
| **Nearest Assignment** | Euclidean distance formula: √((x₂-x₁)² + (y₂-y₁)²) |
| **Complete Ride** | Mark rides as done → driver becomes available again |
| **Live Grid Map** | Canvas-based visual showing all driver positions |
| **Toggle Availability** | Manually set a driver as busy/available |
| **Distance Breakdown** | See distance to every available driver after booking |

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/drivers` | List all drivers |
| POST | `/api/drivers` | Add a new driver |
| DELETE | `/api/drivers/:id` | Remove a driver |
| PATCH | `/api/drivers/:id/toggle` | Toggle driver availability |
| GET | `/api/rides` | List all ride requests |
| POST | `/api/rides` | Request a ride (auto-assigns nearest driver) |
| POST | `/api/rides/:id/complete` | Mark ride as completed |
| GET | `/api/stats` | Dashboard statistics |

## 📐 Distance Algorithm

```
distance = √((driver.x - user.x)² + (driver.y - user.y)²)
```

The driver with the **minimum Euclidean distance** who is **available** gets assigned.

## 🗃️ Database Schema

```sql
CREATE TABLE drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  available INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT NOT NULL,
  user_x REAL NOT NULL,
  user_y REAL NOT NULL,
  driver_id INTEGER,
  driver_name TEXT,
  distance REAL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
