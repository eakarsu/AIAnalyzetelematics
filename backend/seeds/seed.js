const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop tables in reverse dependency order
    await client.query(`
      DROP TABLE IF EXISTS ai_insights CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS maintenance CASCADE;
      DROP TABLE IF EXISTS trips CASCADE;
      DROP TABLE IF EXISTS geofences CASCADE;
      DROP TABLE IF EXISTS fuel_logs CASCADE;
      DROP TABLE IF EXISTS safety_events CASCADE;
      DROP TABLE IF EXISTS routes CASCADE;
      DROP TABLE IF EXISTS drivers CASCADE;
      DROP TABLE IF EXISTS vehicles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE vehicles (
        id SERIAL PRIMARY KEY,
        vin VARCHAR(17) UNIQUE NOT NULL,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        license_plate VARCHAR(20) NOT NULL,
        fuel_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        mileage INTEGER DEFAULT 0,
        lat DECIMAL(10,6) DEFAULT 0,
        lng DECIMAL(10,6) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE drivers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        license_number VARCHAR(50) NOT NULL,
        license_expiry DATE NOT NULL,
        safety_score DECIMAL(5,2) DEFAULT 100.00,
        status VARCHAR(50) DEFAULT 'active',
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        total_trips INTEGER DEFAULT 0,
        total_miles DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE routes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        distance_miles DECIMAL(10,2) NOT NULL,
        estimated_time_mins INTEGER NOT NULL,
        avg_fuel_consumption DECIMAL(5,2),
        traffic_level VARCHAR(50) DEFAULT 'moderate',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE fuel_logs (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
        route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
        gallons DECIMAL(8,2) NOT NULL,
        cost DECIMAL(10,2) NOT NULL,
        mpg DECIMAL(5,2),
        date DATE NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE safety_events (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        speed_at_event DECIMAL(5,1),
        date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE trips (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        distance_miles DECIMAL(10,2),
        fuel_used DECIMAL(8,2),
        avg_speed DECIMAL(5,1),
        max_speed DECIMAL(5,1),
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE maintenance (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        description TEXT,
        scheduled_date DATE NOT NULL,
        completed_date DATE,
        cost DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'scheduled',
        priority VARCHAR(50) DEFAULT 'medium',
        mileage_at_service INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
        type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE geofences (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        center_lat DECIMAL(10,6) NOT NULL,
        center_lng DECIMAL(10,6) NOT NULL,
        radius_miles DECIMAL(8,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        alert_on_entry BOOLEAN DEFAULT TRUE,
        alert_on_exit BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE ai_insights (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        insight TEXT NOT NULL,
        confidence DECIMAL(5,2),
        data JSONB,
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed users
    const hashedPassword = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
      ('admin@fleetiq.com', $1, 'Admin User', 'admin'),
      ('manager@fleetiq.com', $1, 'Fleet Manager', 'manager')
    `, [hashedPassword]);

    // Seed vehicles (15+)
    await client.query(`
      INSERT INTO vehicles (vin, make, model, year, license_plate, fuel_type, status, mileage, lat, lng) VALUES
      ('1HGCM82633A004352', 'Volvo', 'FH16', 2023, 'FL-1001', 'diesel', 'active', 45230, 40.7128, -74.0060),
      ('2HGCM82633A004353', 'Kenworth', 'T680', 2022, 'FL-1002', 'diesel', 'active', 78400, 34.0522, -118.2437),
      ('3HGCM82633A004354', 'Freightliner', 'Cascadia', 2023, 'FL-1003', 'diesel', 'maintenance', 120500, 41.8781, -87.6298),
      ('4HGCM82633A004355', 'Peterbilt', '579', 2021, 'FL-1004', 'diesel', 'active', 95200, 29.7604, -95.3698),
      ('5HGCM82633A004356', 'Mack', 'Anthem', 2023, 'FL-1005', 'diesel', 'active', 32100, 33.4484, -112.0740),
      ('6HGCM82633A004357', 'International', 'LT', 2022, 'FL-1006', 'diesel', 'inactive', 155800, 47.6062, -122.3321),
      ('7HGCM82633A004358', 'Tesla', 'Semi', 2024, 'FL-1007', 'electric', 'active', 12300, 37.7749, -122.4194),
      ('8HGCM82633A004359', 'Volvo', 'VNL', 2022, 'FL-1008', 'diesel', 'active', 88900, 39.7392, -104.9903),
      ('9HGCM82633A004360', 'Kenworth', 'W990', 2023, 'FL-1009', 'diesel', 'active', 41200, 35.2271, -80.8431),
      ('AHGCM82633A004361', 'Freightliner', 'M2', 2021, 'FL-1010', 'diesel', 'active', 134500, 32.7767, -96.7970),
      ('BHGCM82633A004362', 'Peterbilt', '389', 2023, 'FL-1011', 'diesel', 'maintenance', 67800, 42.3601, -71.0589),
      ('CHGCM82633A004363', 'Volvo', 'FMX', 2024, 'FL-1012', 'diesel', 'active', 8900, 36.1627, -86.7816),
      ('DHGCM82633A004364', 'Mack', 'Pinnacle', 2022, 'FL-1013', 'diesel', 'active', 99300, 38.6270, -90.1994),
      ('EHGCM82633A004365', 'Tesla', 'Semi', 2024, 'FL-1014', 'electric', 'active', 5600, 30.2672, -97.7431),
      ('FHGCM82633A004366', 'Kenworth', 'T880', 2023, 'FL-1015', 'diesel', 'active', 52400, 44.9778, -93.2650),
      ('GHGCM82633A004367', 'International', 'HX', 2022, 'FL-1016', 'diesel', 'active', 110200, 25.7617, -80.1918)
    `);

    // Seed drivers (15+)
    await client.query(`
      INSERT INTO drivers (name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id, total_trips, total_miles) VALUES
      ('James Rodriguez', 'james.r@fleet.com', '555-0101', 'CDL-2023-001', '2026-08-15', 95.50, 'active', 1, 342, 48520.50),
      ('Sarah Chen', 'sarah.c@fleet.com', '555-0102', 'CDL-2023-002', '2025-12-20', 98.20, 'active', 2, 287, 41230.75),
      ('Michael Brown', 'michael.b@fleet.com', '555-0103', 'CDL-2023-003', '2026-03-10', 72.30, 'active', 3, 415, 62100.00),
      ('Emily Watson', 'emily.w@fleet.com', '555-0104', 'CDL-2023-004', '2026-06-25', 88.90, 'active', 4, 198, 29450.25),
      ('David Kim', 'david.k@fleet.com', '555-0105', 'CDL-2023-005', '2025-09-30', 91.40, 'active', 5, 356, 51200.50),
      ('Maria Garcia', 'maria.g@fleet.com', '555-0106', 'CDL-2023-006', '2026-01-15', 85.60, 'on_leave', 6, 268, 38900.00),
      ('Robert Taylor', 'robert.t@fleet.com', '555-0107', 'CDL-2023-007', '2026-04-20', 76.80, 'active', 7, 445, 55340.75),
      ('Lisa Anderson', 'lisa.a@fleet.com', '555-0108', 'CDL-2023-008', '2025-11-05', 93.70, 'active', 8, 312, 46780.25),
      ('Carlos Martinez', 'carlos.m@fleet.com', '555-0109', 'CDL-2023-009', '2026-07-18', 67.20, 'active', 9, 389, 58200.50),
      ('Jennifer Lee', 'jennifer.l@fleet.com', '555-0110', 'CDL-2023-010', '2026-02-28', 96.10, 'active', 10, 275, 40100.00),
      ('Thomas Wilson', 'thomas.w@fleet.com', '555-0111', 'CDL-2023-011', '2025-10-12', 82.40, 'active', 11, 401, 59800.75),
      ('Amanda Davis', 'amanda.d@fleet.com', '555-0112', 'CDL-2023-012', '2026-05-08', 90.30, 'active', 12, 234, 34500.50),
      ('Daniel Harris', 'daniel.h@fleet.com', '555-0113', 'CDL-2023-013', '2026-09-22', 78.90, 'active', 13, 367, 52800.25),
      ('Jessica Clark', 'jessica.c@fleet.com', '555-0114', 'CDL-2023-014', '2025-08-17', 94.50, 'active', 14, 189, 27650.00),
      ('Kevin White', 'kevin.w@fleet.com', '555-0115', 'CDL-2023-015', '2026-11-30', 86.70, 'active', 15, 423, 63400.50),
      ('Rachel Moore', 'rachel.m@fleet.com', '555-0116', 'CDL-2023-016', '2026-04-05', 91.80, 'active', 16, 298, 44200.75)
    `);

    // Seed routes (15+)
    await client.query(`
      INSERT INTO routes (name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status) VALUES
      ('Route 88 - Northeast Corridor', 'New York, NY', 'Boston, MA', 215.0, 240, 6.8, 'heavy', 'active'),
      ('Pacific Coast Highway', 'Los Angeles, CA', 'San Francisco, CA', 382.0, 360, 7.2, 'moderate', 'active'),
      ('Midwest Express', 'Chicago, IL', 'Detroit, MI', 282.0, 270, 6.5, 'moderate', 'active'),
      ('Texas Triangle', 'Houston, TX', 'Dallas, TX', 239.0, 210, 6.9, 'light', 'active'),
      ('Desert Crossing', 'Phoenix, AZ', 'Las Vegas, NV', 300.0, 270, 7.8, 'light', 'active'),
      ('Northwest Passage', 'Seattle, WA', 'Portland, OR', 174.0, 180, 6.2, 'moderate', 'active'),
      ('Silicon Valley Run', 'San Jose, CA', 'Sacramento, CA', 120.0, 120, 5.8, 'heavy', 'active'),
      ('Rocky Mountain Route', 'Denver, CO', 'Salt Lake City, UT', 525.0, 480, 8.5, 'light', 'active'),
      ('Southern Belle', 'Charlotte, NC', 'Atlanta, GA', 245.0, 230, 6.7, 'moderate', 'active'),
      ('Lone Star Express', 'Dallas, TX', 'San Antonio, TX', 275.0, 240, 6.4, 'light', 'active'),
      ('Great Lakes Loop', 'Cleveland, OH', 'Buffalo, NY', 190.0, 200, 6.1, 'moderate', 'active'),
      ('Sunshine State Run', 'Miami, FL', 'Orlando, FL', 235.0, 210, 6.6, 'heavy', 'active'),
      ('Music City Route', 'Nashville, TN', 'Memphis, TN', 212.0, 190, 6.3, 'light', 'active'),
      ('Gateway Corridor', 'St. Louis, MO', 'Kansas City, MO', 250.0, 220, 6.8, 'moderate', 'active'),
      ('Capital Beltway', 'Washington, DC', 'Philadelphia, PA', 140.0, 160, 5.9, 'heavy', 'active'),
      ('Bay Area Circuit', 'San Francisco, CA', 'Oakland, CA', 12.0, 25, 4.2, 'heavy', 'active')
    `);

    // Seed fuel logs (15+)
    await client.query(`
      INSERT INTO fuel_logs (vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location) VALUES
      (1, 1, 1, 32.5, 128.75, 6.6, '2026-03-14', 'New York, NY'),
      (2, 2, 2, 55.2, 218.60, 6.9, '2026-03-14', 'Los Angeles, CA'),
      (3, 3, 3, 42.8, 169.50, 6.6, '2026-03-13', 'Chicago, IL'),
      (4, 4, 4, 35.1, 139.00, 6.8, '2026-03-13', 'Houston, TX'),
      (5, 5, 5, 38.5, 152.45, 7.8, '2026-03-12', 'Phoenix, AZ'),
      (6, 6, 6, 28.1, 111.30, 6.2, '2026-03-12', 'Seattle, WA'),
      (8, 8, 8, 61.8, 244.70, 8.5, '2026-03-11', 'Denver, CO'),
      (9, 9, 9, 36.6, 144.90, 6.7, '2026-03-11', 'Charlotte, NC'),
      (10, 10, 10, 43.0, 170.25, 6.4, '2026-03-10', 'Dallas, TX'),
      (11, 11, 11, 31.1, 123.15, 6.1, '2026-03-10', 'Cleveland, OH'),
      (12, 12, 12, 35.6, 141.00, 6.6, '2026-03-09', 'Miami, FL'),
      (13, 13, 13, 33.7, 133.40, 6.3, '2026-03-09', 'Nashville, TN'),
      (14, 14, 15, 23.7, 93.85, 5.9, '2026-03-08', 'Washington, DC'),
      (15, 15, 14, 36.8, 145.70, 6.8, '2026-03-08', 'St. Louis, MO'),
      (16, 16, 16, 2.9, 11.45, 4.1, '2026-03-07', 'San Francisco, CA'),
      (1, 1, 1, 31.8, 125.95, 6.8, '2026-03-07', 'Boston, MA')
    `);

    // Seed safety events (15+)
    await client.query(`
      INSERT INTO safety_events (driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date) VALUES
      (3, 3, 'hard_braking', 'high', 'Sudden hard braking on I-94 near Gary, IN', 'Gary, IN', 68.5, '2026-03-14 08:23:00'),
      (9, 9, 'speeding', 'critical', 'Exceeded speed limit by 22 mph on I-85', 'Gastonia, NC', 87.0, '2026-03-14 11:45:00'),
      (7, 7, 'lane_departure', 'medium', 'Unintended lane departure detected on US-101', 'San Jose, CA', 62.3, '2026-03-13 14:12:00'),
      (3, 3, 'harsh_acceleration', 'medium', 'Rapid acceleration from stop on Michigan Ave', 'Chicago, IL', 45.2, '2026-03-13 09:30:00'),
      (11, 11, 'tailgating', 'high', 'Following too closely on I-90', 'Erie, PA', 71.8, '2026-03-12 16:05:00'),
      (9, 9, 'hard_braking', 'high', 'Emergency braking in construction zone', 'Charlotte, NC', 55.4, '2026-03-12 10:20:00'),
      (13, 13, 'distracted_driving', 'critical', 'Phone usage detected while driving on I-40', 'Nashville, TN', 65.0, '2026-03-11 13:45:00'),
      (7, 7, 'speeding', 'medium', 'Exceeded speed limit by 12 mph on CA-17', 'Los Gatos, CA', 77.0, '2026-03-11 08:15:00'),
      (3, 3, 'seatbelt', 'high', 'Seatbelt unfastened while vehicle in motion', 'Detroit, MI', 35.0, '2026-03-10 07:50:00'),
      (6, 6, 'harsh_cornering', 'medium', 'Sharp turn at excessive speed on SR-99', 'Tacoma, WA', 42.5, '2026-03-10 15:30:00'),
      (11, 11, 'fatigue', 'critical', 'Drowsiness detected after 9 hours of driving', 'Buffalo, NY', 58.2, '2026-03-09 22:10:00'),
      (9, 9, 'speeding', 'high', 'Exceeded speed limit by 18 mph on I-77', 'Statesville, NC', 83.0, '2026-03-09 12:00:00'),
      (13, 13, 'hard_braking', 'medium', 'Hard braking at intersection on Broadway', 'Memphis, TN', 38.5, '2026-03-08 09:45:00'),
      (7, 7, 'lane_departure', 'high', 'Multiple lane departures in 10 min span', 'Oakland, CA', 60.0, '2026-03-08 17:20:00'),
      (3, 3, 'rolling_stop', 'low', 'Failed to complete full stop at stop sign', 'Joliet, IL', 8.5, '2026-03-07 11:30:00'),
      (15, 15, 'harsh_acceleration', 'low', 'Aggressive acceleration from traffic light', 'Minneapolis, MN', 42.0, '2026-03-07 08:00:00')
    `);

    // Seed trips (15+)
    await client.query(`
      INSERT INTO trips (vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status) VALUES
      (1, 1, 1, '2026-03-14 06:00:00', '2026-03-14 10:05:00', 215.0, 32.5, 53.0, 72.0, 'completed'),
      (2, 2, 2, '2026-03-14 05:30:00', '2026-03-14 11:30:00', 382.0, 55.2, 63.7, 75.0, 'completed'),
      (3, 3, 3, '2026-03-13 07:00:00', '2026-03-13 11:30:00', 282.0, 42.8, 62.7, 78.0, 'completed'),
      (4, 4, 4, '2026-03-13 08:00:00', '2026-03-13 11:30:00', 239.0, 35.1, 68.3, 80.0, 'completed'),
      (5, 5, 5, '2026-03-12 06:00:00', '2026-03-12 10:30:00', 300.0, 38.5, 66.7, 82.0, 'completed'),
      (6, 6, 6, '2026-03-12 09:00:00', '2026-03-12 12:00:00', 174.0, 28.1, 58.0, 70.0, 'completed'),
      (7, 7, 7, '2026-03-12 07:00:00', '2026-03-12 09:00:00', 120.0, 0.0, 60.0, 68.0, 'completed'),
      (8, 8, 8, '2026-03-11 05:00:00', '2026-03-11 13:00:00', 525.0, 61.8, 65.6, 78.0, 'completed'),
      (9, 9, 9, '2026-03-11 06:30:00', '2026-03-11 10:20:00', 245.0, 36.6, 63.9, 87.0, 'completed'),
      (10, 10, 10, '2026-03-10 07:00:00', '2026-03-10 11:00:00', 275.0, 43.0, 68.8, 76.0, 'completed'),
      (11, 11, 11, '2026-03-10 08:00:00', '2026-03-10 11:20:00', 190.0, 31.1, 57.0, 72.0, 'completed'),
      (12, 12, 12, '2026-03-09 06:00:00', '2026-03-09 09:30:00', 235.0, 35.6, 67.1, 78.0, 'completed'),
      (13, 13, 13, '2026-03-09 07:00:00', '2026-03-09 10:10:00', 212.0, 33.7, 66.3, 74.0, 'completed'),
      (14, 14, 15, '2026-03-08 06:30:00', '2026-03-08 09:10:00', 140.0, 23.7, 52.5, 68.0, 'completed'),
      (15, 15, 14, '2026-03-08 05:00:00', '2026-03-08 08:40:00', 250.0, 36.8, 68.2, 80.0, 'completed'),
      (1, 1, 1, '2026-03-15 06:00:00', NULL, 108.0, 16.2, 55.0, 70.0, 'in_progress')
    `);

    // Seed maintenance (15+)
    await client.query(`
      INSERT INTO maintenance (vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service) VALUES
      (3, 'Engine Repair', 'Replace turbocharger assembly', '2026-03-18', NULL, 4500.00, 'scheduled', 'critical', 120500),
      (11, 'Brake Service', 'Replace front and rear brake pads', '2026-03-20', NULL, 850.00, 'scheduled', 'high', 67800),
      (1, 'Oil Change', 'Full synthetic oil change and filter', '2026-03-10', '2026-03-10', 189.00, 'completed', 'medium', 45000),
      (6, 'Transmission', 'Transmission fluid flush and filter', '2026-03-15', NULL, 1200.00, 'in_progress', 'high', 155800),
      (2, 'Tire Rotation', 'Rotate and balance all tires', '2026-03-22', NULL, 120.00, 'scheduled', 'low', 78400),
      (5, 'Battery Check', 'Test and replace battery if needed', '2026-03-25', NULL, 350.00, 'scheduled', 'medium', 32100),
      (8, 'Air Filter', 'Replace engine air filter and cabin filter', '2026-03-12', '2026-03-12', 95.00, 'completed', 'low', 88500),
      (10, 'Coolant Flush', 'Complete cooling system flush', '2026-03-28', NULL, 275.00, 'scheduled', 'medium', 134500),
      (4, 'Alignment', 'Four-wheel alignment check and adjustment', '2026-03-16', NULL, 180.00, 'scheduled', 'medium', 95200),
      (9, 'Suspension', 'Replace front shock absorbers', '2026-03-19', NULL, 1650.00, 'scheduled', 'high', 41200),
      (12, 'DEF System', 'DEF system cleaning and sensor replacement', '2026-03-30', NULL, 780.00, 'scheduled', 'medium', 8900),
      (13, 'Exhaust', 'DPF regeneration and exhaust inspection', '2026-03-17', NULL, 550.00, 'scheduled', 'high', 99300),
      (7, 'Software Update', 'Update vehicle firmware and telematics', '2026-03-11', '2026-03-11', 0.00, 'completed', 'low', 12300),
      (15, 'Brake Inspection', 'Full brake system inspection', '2026-04-01', NULL, 150.00, 'scheduled', 'medium', 52400),
      (14, 'Charging System', 'Inspect charging port and cable', '2026-03-23', NULL, 200.00, 'scheduled', 'low', 5600),
      (16, 'Full Service', 'Complete 100K mile service package', '2026-03-21', NULL, 3200.00, 'scheduled', 'critical', 110200)
    `);

    // Seed alerts (15+)
    await client.query(`
      INSERT INTO alerts (vehicle_id, driver_id, type, severity, message, is_read) VALUES
      (3, 3, 'maintenance', 'critical', 'Vehicle FL-1003: Engine turbocharger failure imminent. Immediate service required.', false),
      (9, 9, 'safety', 'critical', 'Driver Carlos Martinez: 3 speeding violations in 48 hours. Immediate review needed.', false),
      (13, 13, 'safety', 'critical', 'Driver Daniel Harris: Phone usage detected while driving. Safety protocol violation.', false),
      (11, 11, 'safety', 'high', 'Driver Thomas Wilson: Fatigue alert triggered after extended driving hours.', false),
      (6, NULL, 'maintenance', 'high', 'Vehicle FL-1006: Transmission service overdue by 2 weeks.', false),
      (1, 1, 'fuel', 'medium', 'Route 88: Fuel consumption 15% above fleet average. Investigate traffic patterns.', true),
      (2, 2, 'performance', 'low', 'Driver Sarah Chen: Exceptional safety performance. Safety score 98.2%.', true),
      (5, 5, 'geofence', 'medium', 'Vehicle FL-1005 exited designated zone "Southwest Region".', false),
      (16, 16, 'maintenance', 'critical', 'Vehicle FL-1016: 100K mile service overdue. Schedule immediately.', false),
      (7, 7, 'safety', 'medium', 'Driver Robert Taylor: Multiple lane departures detected. Schedule training.', false),
      (4, 4, 'fuel', 'low', 'Vehicle FL-1004: Fuel efficiency improved 8% after route optimization.', true),
      (12, 12, 'weather', 'high', 'Severe weather alert on Sunshine State Run. Consider route delay.', false),
      (8, 8, 'performance', 'medium', 'Route Rocky Mountain: Average trip time exceeded estimate by 25 mins.', false),
      (15, 15, 'maintenance', 'medium', 'Vehicle FL-1015: Brake inspection due within 5,000 miles.', false),
      (10, 10, 'compliance', 'high', 'Driver Jennifer Lee: Hours of Service approaching maximum. Rest required.', false),
      (14, 14, 'fuel', 'low', 'Tesla Semi FL-1014: Charging efficiency optimal at 98.5%.', true)
    `);

    // Seed geofences (15+)
    await client.query(`
      INSERT INTO geofences (name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit) VALUES
      ('NYC Distribution Hub', 'warehouse', 40.7128, -74.0060, 5.0, 'active', true, true),
      ('LA Logistics Center', 'warehouse', 34.0522, -118.2437, 8.0, 'active', true, true),
      ('Chicago Yard', 'depot', 41.8781, -87.6298, 3.0, 'active', true, false),
      ('Houston Terminal', 'terminal', 29.7604, -95.3698, 6.0, 'active', true, true),
      ('Phoenix Rest Stop Zone', 'rest_area', 33.4484, -112.0740, 2.0, 'active', false, true),
      ('Seattle Port', 'port', 47.6062, -122.3321, 4.0, 'active', true, true),
      ('Bay Area Tech Campus', 'customer', 37.7749, -122.4194, 1.5, 'active', true, false),
      ('Denver Fuel Station', 'fuel', 39.7392, -104.9903, 1.0, 'active', true, false),
      ('Charlotte Warehouse', 'warehouse', 35.2271, -80.8431, 5.0, 'active', true, true),
      ('DFW Airport Zone', 'restricted', 32.8998, -97.0403, 10.0, 'active', true, true),
      ('Boston Seaport', 'port', 42.3601, -71.0589, 3.0, 'active', true, true),
      ('Nashville Distribution', 'warehouse', 36.1627, -86.7816, 4.0, 'active', true, false),
      ('STL Gateway Hub', 'depot', 38.6270, -90.1994, 5.0, 'active', true, true),
      ('Miami Customs Zone', 'restricted', 25.7617, -80.1918, 7.0, 'active', true, true),
      ('Minneapolis Cold Storage', 'warehouse', 44.9778, -93.2650, 3.0, 'active', true, true),
      ('Austin EV Charging Hub', 'fuel', 30.2672, -97.7431, 2.0, 'active', true, false)
    `);

    // Seed AI insights (15+)
    await client.query(`
      INSERT INTO ai_insights (category, title, insight, confidence, data, status) VALUES
      ('fuel', 'Route 88 High Consumption', 'Vehicles on Route 88 are experiencing 15% higher fuel consumption due to traffic patterns between exits 12-18. Recommend scheduling departures before 6 AM.', 94.5, '{"route_id": 1, "excess_consumption": 15, "peak_hours": "7AM-9AM"}', 'new'),
      ('safety', 'Driver Fatigue Pattern', 'Analysis shows 40% of safety incidents occur after 8+ hours of continuous driving. 3 drivers consistently exceed recommended hours.', 91.2, '{"affected_drivers": [3, 9, 11], "incident_threshold_hours": 8}', 'new'),
      ('maintenance', 'Predictive Brake Failure', 'Based on mileage patterns and sensor data, vehicles FL-1011 and FL-1003 show 87% probability of brake system issues within 30 days.', 87.0, '{"vehicle_ids": [11, 3], "probability": 87, "timeframe_days": 30}', 'acknowledged'),
      ('routing', 'Optimal Departure Times', 'Fleet-wide analysis reveals departures between 5-6 AM reduce average trip time by 18% and fuel costs by 12%.', 96.3, '{"optimal_window": "5AM-6AM", "time_savings": 18, "fuel_savings": 12}', 'new'),
      ('fuel', 'Electric vs Diesel TCO', 'Tesla Semi units show 62% lower per-mile operating cost compared to diesel fleet average. ROI breakeven projected at 18 months.', 89.8, '{"ev_cost_per_mile": 0.12, "diesel_cost_per_mile": 0.32, "breakeven_months": 18}', 'new'),
      ('safety', 'Intersection Hotspots', 'Data identifies 5 intersections with 73% of fleet hard-braking events. Recommend route adjustments or driver alerts.', 92.1, '{"hotspot_count": 5, "event_concentration": 73}', 'acknowledged'),
      ('performance', 'Fleet Utilization Gap', 'Current fleet utilization is 68%. Optimizing scheduling could increase to 82%, equivalent to retiring 3 vehicles.', 88.5, '{"current_utilization": 68, "target_utilization": 82, "excess_vehicles": 3}', 'new'),
      ('maintenance', 'Oil Change Optimization', 'Analysis of engine data shows oil change intervals can be safely extended by 15% for 2023+ Volvo models, saving $12,400/year.', 85.3, '{"extended_interval_pct": 15, "annual_savings": 12400, "affected_models": ["Volvo FH16", "Volvo VNL"]}', 'new'),
      ('fuel', 'Idling Cost Analysis', 'Fleet-wide idling accounts for 8.2% of total fuel consumption. Top 5 idling vehicles waste approximately $2,300/month.', 93.7, '{"idling_pct": 8.2, "monthly_waste": 2300, "top_idlers": [3, 6, 11, 13, 16]}', 'new'),
      ('routing', 'Weather-Adjusted Routes', 'Historical weather data suggests Route 8 (Rocky Mountain) should use alternate I-80 corridor Dec-Feb, reducing delays by 35%.', 86.4, '{"route_id": 8, "delay_reduction": 35, "season": "winter"}', 'acknowledged'),
      ('safety', 'Training Effectiveness', 'Drivers who completed advanced safety training show 34% fewer incidents. 6 drivers are overdue for refresher courses.', 90.8, '{"improvement_pct": 34, "overdue_count": 6}', 'new'),
      ('performance', 'Delivery Time Trends', 'On-time delivery rate dropped from 94% to 87% this month. Primary contributor: increased dwell time at Houston and Miami terminals.', 95.1, '{"current_rate": 87, "previous_rate": 94, "problem_locations": ["Houston", "Miami"]}', 'new'),
      ('fuel', 'Tire Pressure Impact', 'Vehicles with properly maintained tire pressure show 4.2% better fuel economy. 7 vehicles have consistently low readings.', 91.5, '{"fuel_improvement": 4.2, "affected_vehicles": 7}', 'new'),
      ('maintenance', 'Component Lifecycle', 'Freightliner Cascadia brake pads averaging 45K miles vs expected 60K. Investigate driving patterns on assigned routes.', 84.2, '{"actual_life_miles": 45000, "expected_life_miles": 60000, "model": "Freightliner Cascadia"}', 'new'),
      ('routing', 'Multi-Stop Optimization', 'Current multi-stop routes average 12% excess mileage. AI optimization could save 340 miles/day fleet-wide.', 93.0, '{"excess_mileage_pct": 12, "daily_savings_miles": 340}', 'new'),
      ('performance', 'Driver Scorecard Trends', 'Fleet average safety score improved from 84.2 to 87.6 over 90 days. Bottom quartile drivers account for 71% of all incidents.', 97.2, '{"current_avg": 87.6, "previous_avg": 84.2, "bottom_quartile_incident_pct": 71}', 'new')
    `);

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully with all data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
