const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite DB
const db = new sqlite3.Database(path.join(__dirname, 'cab_system.db'), (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('✅ Connected to SQLite database.');
});

// Helper to run queries
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

// ─── UTILITY ────────────────────────────────────────────────────────────────
function euclideanDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// ─── INIT DB ────────────────────────────────────────────────────────────────
async function initDB() {
  await run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_x REAL NOT NULL,
      user_y REAL NOT NULL,
      driver_id INTEGER,
      driver_name TEXT,
      distance REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )
  `);

  // Seed drivers if empty
  const row = await get('SELECT COUNT(*) as count FROM drivers');
  if (row.count === 0) {
    const drivers = [
      ['Alice', 2, 3],
      ['Bob', 7, 1],
      ['Charlie', 5, 8],
      ['Diana', 10, 4],
      ['Ethan', 1, 9],
    ];
    for (const [name, x, y] of drivers) {
      await run('INSERT INTO drivers (name, x, y) VALUES (?, ?, ?)', [name, x, y]);
    }
    console.log('🌱 Seeded 5 default drivers.');
  }
}

// ─── DRIVER ROUTES ──────────────────────────────────────────────────────────

// GET all drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await all('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json({ success: true, data: drivers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add new driver
app.post('/api/drivers', async (req, res) => {
  try {
    const { name, x, y } = req.body;
    if (!name || x === undefined || y === undefined) {
      return res.status(400).json({ success: false, message: 'Name, x, and y coordinates are required.' });
    }
    const { lastID } = await run('INSERT INTO drivers (name, x, y) VALUES (?, ?, ?)', [name.trim(), parseFloat(x), parseFloat(y)]);
    const driver = await get('SELECT * FROM drivers WHERE id = ?', [lastID]);
    res.status(201).json({ success: true, data: driver, message: `Driver "${name}" added successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE driver
app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });
    await run('DELETE FROM drivers WHERE id = ?', [id]);
    res.json({ success: true, message: `Driver "${driver.name}" removed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle driver availability
app.patch('/api/drivers/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });
    const newAvail = driver.available === 1 ? 0 : 1;
    await run('UPDATE drivers SET available = ? WHERE id = ?', [newAvail, id]);
    const updated = await get('SELECT * FROM drivers WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: `Driver "${driver.name}" is now ${newAvail ? 'available' : 'unavailable'}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── RIDE ROUTES ────────────────────────────────────────────────────────────

// GET all rides
app.get('/api/rides', async (req, res) => {
  try {
    const rides = await all('SELECT * FROM rides ORDER BY created_at DESC');
    res.json({ success: true, data: rides });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST request a ride (assigns nearest available driver)
app.post('/api/rides', async (req, res) => {
  try {
    const { user_name, user_x, user_y } = req.body;
    if (!user_name || user_x === undefined || user_y === undefined) {
      return res.status(400).json({ success: false, message: 'User name, x, and y are required.' });
    }

    const ux = parseFloat(user_x);
    const uy = parseFloat(user_y);

    const availableDrivers = await all('SELECT * FROM drivers WHERE available = 1');

    if (availableDrivers.length === 0) {
      const { lastID } = await run(
        'INSERT INTO rides (user_name, user_x, user_y, status) VALUES (?, ?, ?, ?)',
        [user_name.trim(), ux, uy, 'no_driver_available']
      );
      const ride = await get('SELECT * FROM rides WHERE id = ?', [lastID]);
      return res.status(200).json({
        success: false,
        message: 'No available drivers right now. Your request has been logged.',
        data: ride,
      });
    }

    // Find nearest driver
    let nearestDriver = null;
    let minDistance = Infinity;
    for (const driver of availableDrivers) {
      const dist = euclideanDistance(ux, uy, driver.x, driver.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestDriver = driver;
      }
    }

    // Mark driver unavailable
    await run('UPDATE drivers SET available = 0 WHERE id = ?', [nearestDriver.id]);

    // Calculate driver distances for all available drivers (for response info)
    const distanceInfo = availableDrivers.map(d => ({
      id: d.id,
      name: d.name,
      distance: parseFloat(euclideanDistance(ux, uy, d.x, d.y).toFixed(2))
    })).sort((a, b) => a.distance - b.distance);

    // Insert ride
    const { lastID } = await run(
      'INSERT INTO rides (user_name, user_x, user_y, driver_id, driver_name, distance, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_name.trim(), ux, uy, nearestDriver.id, nearestDriver.name, parseFloat(minDistance.toFixed(2)), 'assigned']
    );
    const ride = await get('SELECT * FROM rides WHERE id = ?', [lastID]);

    res.status(201).json({
      success: true,
      message: `Driver "${nearestDriver.name}" assigned! Distance: ${minDistance.toFixed(2)} units.`,
      data: ride,
      allDistances: distanceInfo,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH edit driver coordinates
app.patch('/api/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { x, y } = req.body;
    if (x === undefined || y === undefined) {
      return res.status(400).json({ success: false, message: 'x and y are required.' });
    }
    const driver = await get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });
    await run('UPDATE drivers SET x = ?, y = ? WHERE id = ?', [parseFloat(x), parseFloat(y), id]);
    const updated = await get('SELECT * FROM drivers WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: `Driver "${driver.name}" location updated to (${x}, ${y}).` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST complete a ride
app.post('/api/rides/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await get('SELECT * FROM rides WHERE id = ?', [id]);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });
    if (ride.status !== 'assigned') return res.status(400).json({ success: false, message: 'Only assigned rides can be completed.' });

    await run('UPDATE rides SET status = ? WHERE id = ?', ['completed', id]);
    if (ride.driver_id) await run('UPDATE drivers SET available = 1 WHERE id = ?', [ride.driver_id]);

    res.json({ success: true, message: `Ride #${id} completed! Driver "${ride.driver_name}" is now available.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST cancel a ride
app.post('/api/rides/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await get('SELECT * FROM rides WHERE id = ?', [id]);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });
    if (ride.status !== 'assigned') return res.status(400).json({ success: false, message: 'Only assigned rides can be cancelled.' });

    await run('UPDATE rides SET status = ? WHERE id = ?', ['cancelled', id]);
    if (ride.driver_id) await run('UPDATE drivers SET available = 1 WHERE id = ?', [ride.driver_id]);

    res.json({ success: true, message: `Ride #${id} cancelled. Driver "${ride.driver_name}" is now available.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET stats
app.get('/api/stats', async (req, res) => {
  try {
    const [totalDrivers, availableDrivers, totalRides, completedRides, assignedRides, cancelledRides] = await Promise.all([
      get('SELECT COUNT(*) as count FROM drivers'),
      get('SELECT COUNT(*) as count FROM drivers WHERE available = 1'),
      get('SELECT COUNT(*) as count FROM rides'),
      get("SELECT COUNT(*) as count FROM rides WHERE status = 'completed'"),
      get("SELECT COUNT(*) as count FROM rides WHERE status = 'assigned'"),
      get("SELECT COUNT(*) as count FROM rides WHERE status = 'cancelled'"),
    ]);
    res.json({
      success: true,
      data: {
        totalDrivers: totalDrivers.count,
        availableDrivers: availableDrivers.count,
        totalRides: totalRides.count,
        completedRides: completedRides.count,
        assignedRides: assignedRides.count,
        cancelledRides: cancelledRides.count,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start server after DB init
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚕 Cab Assignment Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  });
