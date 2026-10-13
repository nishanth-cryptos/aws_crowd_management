# 🎓 Real-Time Student Crowd Management via Network Activity Analysis

A full-stack MERN application that simulates and visualizes real-time student crowd levels across various campus zones using network activity data and DBSCAN clustering algorithm.

![Dashboard Preview](https://img.shields.io/badge/Status-Live-success) ![Node](https://img.shields.io/badge/Node-14%2B-green) ![MongoDB](https://img.shields.io/badge/MongoDB-6.0-brightgreen)

## 🎯 Project Overview

This Computer Networks demo project demonstrates real-time crowd management using:
- **DBSCAN Clustering** for density-based crowd detection
- **Socket.IO** for real-time bi-directional communication
- **MongoDB** for time-series data storage
- **React + Recharts** for interactive data visualization

### Key Features

✅ Real-time crowd monitoring across 9 campus zones  
✅ DBSCAN-based density clustering  
✅ Live WebSocket updates every 5 seconds  
✅ Historical data tracking and forecasting  
✅ Color-coded zone status (Normal/Moderate/Overcrowded)  
✅ Interactive charts and statistics  
✅ Responsive modern UI with animations  

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   Frontend  │◄────────┤   Socket.IO  │────────►│   Backend  │
│  (React)    │  WSS    │              │         │  (Node.js) │
└─────────────┘         └──────────────┘         └─────┬──────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │   MongoDB   │
                                                 └─────────────┘
```

## 🧱 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **MongoDB** - Database
- **Mongoose** - ODM
- **density-clustering** - DBSCAN implementation

### Frontend
- **React 18** - UI library
- **Recharts** - Chart visualization
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Axios** - HTTP client
- **Socket.IO Client** - WebSocket client

## 📂 Project Structure

```
RealTime_Crowd_Management_MERN/
│
├── backend/
│   ├── server.js              # Main server file
│   ├── models/
│   │   └── Zone.js            # MongoDB schema
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js             # Main component
│   │   ├── socket.js          # Socket.IO client
│   │   ├── index.js           # Entry point
│   │   └── index.css          # Tailwind styles
│   ├── package.json
│   └── tailwind.config.js
│
├── README.md
└── Project_Report.pdf
```

## 🏫 Campus Zones

| Zone              | Capacity | Default Population |
|-------------------|----------|--------------------|
| AB1               | 5880     | ~4625              |
| AB2               | 250      | ~871               |
| AB3               | 5880     | ~2579              |
| AB4               | 5880     | ~525               |
| Library           | 300      | ~448               |
| Admin Block       | 250      | ~169               |
| North Square      | 200      | Variable           |
| Gazebo            | 200      | Variable           |
| MBA Amphitheater  | 150      | Variable           |

## 🚀 Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v6.0 or higher)
- npm or yarn

### Step 1: Clone Repository

```bash
git clone https://github.com/NithishKannanM/crowd-management-mern.git
cd crowd-management-mern
```

### Step 2: Setup Backend

```bash
cd backend
npm install

# Create .env file
echo "MONGODB_URI=mongodb://localhost:27017/crowd_management" > .env
echo "PORT=5000" >> .env

# Start MongoDB (if not running)
mongod

# Start backend server
npm start
```

Expected output:
```
✅ MongoDB Connected
🚀 Server running on port 5000
📡 Socket.IO server active
🔄 Generating new crowd data...
```

### Step 3: Setup Frontend

```bash
cd frontend
npm install

# Create .env file
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env

# Start React app
npm start
```

The application will open at `http://localhost:3000`

## 🧮 DBSCAN Algorithm Implementation

### How It Works

1. **Data Generation**: Simulates network activity (Wi-Fi connections) for each zone
2. **Coordinate Assignment**: Assigns random 2D coordinates to each zone
3. **DBSCAN Clustering**: 
   - **Epsilon (ε)**: 30 units (neighborhood radius)
   - **MinPoints**: 2 (minimum points to form cluster)
4. **Density Calculation**: `density = (population / capacity) × 120`
5. **Status Assignment**:
   - 🟢 Normal: ≤60% capacity
   - 🟡 Moderate: 60-85% capacity
   - 🔴 Overcrowded: >85% capacity

### Code Snippet

```javascript
function applyDBSCAN(zoneData) {
  const dbscan = new DBSCAN();
  const coordinates = zoneData.map(z => z.coordinates);
  
  // Run DBSCAN (epsilon: 30, minPoints: 2)
  const clusters = dbscan.run(coordinates, 30, 2);
  
  // Assign clusters and calculate density
  return zoneData.map((zone, idx) => {
    let clusterId = -1;
    clusters.forEach((cluster, clusterIdx) => {
      if (cluster.includes(idx)) clusterId = clusterIdx;
    });
    
    const density = Math.floor((zone.population / zone.capacity) * 120);
    const percentage = (zone.population / zone.capacity) * 100;
    
    let status = 'normal';
    if (percentage > 85) status = 'overcrowded';
    else if (percentage > 60) status = 'moderate';
    
    return { ...zone, clusterId, density, status };
  });
}
```

## 📡 Real-Time Communication Flow

### Socket.IO Events

**Server → Client**
- `zoneUpdate` - Sends updated zone data every 5 seconds

**Client → Server**
- `requestUpdate` - Manually request data update
- `connection` - Establish WebSocket connection
- `disconnect` - Handle client disconnection

### Data Flow

```
1. Backend generates simulated network activity
   ↓
2. DBSCAN clustering applied
   ↓
3. Data saved to MongoDB
   ↓
4. Broadcast to all connected clients via Socket.IO
   ↓
5. Frontend updates UI in real-time
```

## 📊 API Endpoints

### REST API

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | `/api/zones`          | Get latest data for all zones  |
| GET    | `/api/history/:zoneId`| Get 15-min history for a zone  |
| GET    | `/api/summary`        | Get summary statistics         |
| GET    | `/health`             | Health check endpoint          |

### Example Response

```json
{
  "success": true,
  "data": [
    {
      "zoneId": "AB1",
      "zoneName": "AB1",
      "population": 4625,
      "density": 108,
      "cluster": 2,
      "capacity": 5880,
      "status": "normal",
      "timestamp": "2025-10-21T11:36:04.000Z"
    }
  ]
}
```

## 🎨 UI Components

### Dashboard Features

1. **Header**: Real-time clock, connection status, refresh button
2. **Stats Cards**: Total population, active zones, avg density, flow trend
3. **Line Chart**: Population trend over past 6 hours
4. **Bar Chart**: Forecast for next 6 hours
5. **Zone Cards**: Individual zone status with color coding

### Color Scheme

- **Background**: Dark gradient (slate-900 → slate-800)
- **Cards**: Semi-transparent slate-800 with blur effect
- **Status Colors**:
  - 🟢 Green (Normal): `#10b981`
  - 🟡 Yellow (Moderate): `#eab308`
  - 🔴 Red (Overcrowded): `#ef4444`

## 🧪 Testing

### Backend Testing

```bash
# Test MongoDB connection
curl http://localhost:5000/health

# Test zones endpoint
curl http://localhost:5000/api/zones

# Test summary endpoint
curl http://localhost:5000/api/summary

# Test zone history
curl http://localhost:5000/api/history/AB1
```

### Frontend Testing

1. Open browser console (F12)
2. Check WebSocket connection: `✅ Connected to Socket.IO server`
3. Monitor real-time updates: `📡 Received zone update`
4. Verify data refresh every 5 seconds

## 📈 Performance Optimization

- **Debouncing**: Limits update frequency to 5 seconds
- **MongoDB Indexing**: Optimized queries with compound indexes
- **React Memoization**: Prevents unnecessary re-renders
- **WebSocket Compression**: Reduces data transfer size
- **Chart Throttling**: Smooth animations without lag

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Error**
```bash
# Solution: Start MongoDB service
mongod --dbpath /path/to/data
```

**Port Already in Use**
```bash
# Solution: Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Socket.IO Connection Failed**
```bash
# Solution: Check CORS settings and backend URL
# In frontend/.env
REACT_APP_SOCKET_URL=http://localhost:5000
```

**Recharts Not Rendering**
```bash
# Solution: Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 🔒 Security Considerations

- ✅ CORS configured for specific origins
- ✅ Input validation on API endpoints
- ✅ Rate limiting on Socket.IO connections
- ✅ MongoDB injection prevention via Mongoose
- ✅ Environment variables for sensitive data

## 📝 Future Enhancements

- [ ] User authentication (JWT)
- [ ] Push notifications for overcrowding
- [ ] Historical data analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Machine learning predictions
- [ ] Multi-campus support
- [ ] Export reports (PDF/Excel)
- [ ] Admin panel for zone management

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request


## 👥 Authors

- **Nithish Kannan M** - *Initial work and ML development* - [GitHub Profile](https://github.com/NithishKannanM)

## 🙏 Acknowledgments

- **DBSCAN Algorithm** - Martin Ester, Hans-Peter Kriegel (1996)
- **Socket.IO** - Real-time communication library
- **Recharts** - Chart visualization library
- **MongoDB** - NoSQL database
- **React Community** - UI framework and ecosystem

## 📚 References

1. [DBSCAN Clustering Algorithm](https://en.wikipedia.org/wiki/DBSCAN)
2. [Socket.IO Documentation](https://socket.io/docs/)
3. [MongoDB Best Practices](https://docs.mongodb.com/manual/)
4. [React Performance Optimization](https://react.dev/learn)
5. [Recharts Documentation](https://recharts.org/)

## 📞 Support

For issues or questions:
- 📧 Email: nithishkannanm11@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/NithishKannanM/Real-Time-Crowd-Management-System/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/NithishKannanM/Real-Time-Crowd-Management-System/discussions)

---

**Made with ❤️ for Computer Networks Project**

**⭐ Star this repo if you find it helpful!**


## Cloud DA3 - AWS Service Simulation

### Problem Statement

Monitor crowd congestion across college locations, detect threshold breaches, notify viewers, and recommend a less crowded connected zone. The existing MERN crowd-management system, DBSCAN clustering, MongoDB models, bookings, forecasts, replay, alerts, and evacuation routing remain in place.

### AWS Service

**Amazon CloudWatch**, simulated locally. There is no AWS connection and no AWS account or paid resource is required.

### Supporting Service

**Amazon SNS notification concept**, simulated as labeled entries inside the AWS Monitoring tab. No actual SNS message, email, or SMS is sent.

### Why CloudWatch?

A changing crowd count is a time-series metric. Threshold evaluation and alarm state transitions let administrators distinguish a congestion episode from repeated observations during that episode. Notifications are triggered by alarm entry rather than every sample.

### Architecture

```text
Existing network-activity simulator → existing DBSCAN crowd processing
  → CrowdCount metric (population from each existing campus zone)
  → CloudWatch-style alarm evaluation and state/history
  → Simulated SNS notification action
  → Intelligent severity and connected-zone recommendation
  → AWS Monitoring tab (React + existing Recharts/Tailwind)
```

The original five-second generator produces the metric input. Demo controls inject deterministic counts into that same generator before DBSCAN; they do not create a second crowd simulator. Monitoring observes the processed counts before database saving. Existing MongoDB zone history and bookings retain their original storage behavior.

### Core AWS Functionality Simulated

- **Namespace:** `College/CrowdManagement`.
- **Metric:** `CrowdCount`, unit `Count`, from the existing zone `population`.
- **Dimension:** `Location = <existing campus zone name>`. Each location has its own alarm, configuration and history. The default demonstration location is **North Square**, an existing zone, rather than an invented gate.
- **Alarm:** `HighCrowdAlarm-<zoneId>`; default comparison `GreaterThanThreshold`, default threshold **70**.
- **Evaluation:** default 1-of-1 observation. Configure N from 1 to 5; ALARM requires all N most recent consecutive observations to exceed the threshold. Until N observations arrive, state is INSUFFICIENT_DATA. With a complete window, any nonbreaching sample makes the state OK.
- **States:** OK, ALARM and INSUFFICIENT_DATA. No new observation for 20 seconds produces INSUFFICIENT_DATA and clears the evaluation window. Fresh samples restore evaluation.
- **History:** timestamps, location, count, severity, sample-time alarm state, threshold and source. Last 120 observations and last 100 alarm events/notifications are retained **per location in backend memory**.
- **Transitions:** initial INSUFFICIENT_DATA → OK/ALARM, OK → ALARM, ALARM → OK and missing-data transitions. Configuration changes are also recorded.
- **Triggered action:** one clearly labeled **Simulated SNS Notification** on entry to ALARM, including entry from INSUFFICIENT_DATA. Repeated ALARM samples do not produce repeated notifications. One additional CRITICAL escalation notification is permitted per alarm episode; this is an application enhancement rather than a second CloudWatch state change. Recovery itself does not send an SNS notification in this implementation.

This is a simplified observation-based teaching model. Actual CloudWatch evaluates statistics over configured time periods and has richer missing-data and M-of-N behavior. The five-second demo tick is not an actual AWS alarm period. At exactly 70, the default crowd severity is HIGH but the strict `CrowdCount > 70` alarm comparison is **OK**.

### Enhancement

**Intelligent severity classification and alternative-route recommendation:**

| Count (default boundaries) | Severity |
|---|---|
| 0–49 | NORMAL |
| 50–69 | MODERATE |
| 70–89 | HIGH |
| 90+ | CRITICAL |

Configure all three severity boundaries and the alarm threshold in the monitoring UI. These absolute-count levels are independent of the original dashboard's capacity-percentage status, which is unchanged. In live simulation, tune a location's threshold to its capacity and operational needs; large academic blocks naturally exceed a demonstration threshold of 70.

For HIGH or CRITICAL crowd, use the existing campus graph to select the connected zone with the lowest crowd count that is less crowded than the source and below 85% occupancy. The UI shows its count, occupancy and data source. If no suitable connected zone exists, it recommends staff-managed entry instead of inventing a route. It does not replace the existing Dijkstra evacuation feature or promise enough space for an entire crowd.

In deterministic demo mode, up to two existing connected zones receive explicitly labeled **simulated** alternative counts of 48 and 31. For North Square these are Admin Block (48) and Gazebo (31), so Gazebo is the predictable recommendation. All other zones continue the original random generator. Resume live updates removes these overrides on the next normal update.

### How to Run

Run commands from this repository's root. Node.js 18+ is required for the added built-in test runner; MongoDB must be available for the original database features. These commands use port **5001** because the existing frontend defaults to 5001 and macOS may occupy 5000. Explicit environment values also take precedence over any existing `.env` file.

Install the existing dependencies (no new runtime dependencies):

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

If you do not already have MongoDB running, start a locally installed MongoDB in a separate terminal:

```bash
mkdir -p .tmp/mongo-data
mongod --dbpath "$PWD/.tmp/mongo-data" --bind_ip 127.0.0.1 --port 27017
```

Backend terminal:

```bash
PORT=5001 MONGODB_URI=mongodb://127.0.0.1:27017/crowd_management npm --prefix backend start
```

Frontend terminal:

```bash
REACT_APP_API_URL=http://localhost:5001/api REACT_APP_SOCKET_URL=http://localhost:5001 npm --prefix frontend start
```

Open **http://localhost:3000** and select **AWS Monitoring**. Keep the backend running; wait for the next five-second update after each demo action. Alternatively, the existing Docker Compose setup remains available with `docker compose up --build`; its host port 5000 must be free, and its explicit frontend environment selects that port.

Validation commands:

```bash
node --test backend/monitoring/*.test.js
CI=true npm --prefix frontend test -- --watchAll=false --runInBand
npm --prefix frontend run build
curl http://localhost:5001/health
curl http://localhost:5001/api/monitoring/North
```

### Demonstration Steps

1. Show the original Crowd Dashboard, its nine campus zones and live updates. Open AWS Monitoring and select **North Square**.
2. Keep default threshold 70, evaluation 1, severity boundaries 50/70/90. If you changed them, save these values first.
3. Click **Simulate Normal Crowd**. After the next update, show count 35, NORMAL, OK and the metric namespace/dimension/unit.
4. Click **Simulate Crowd Surge**. Watch **35 → 47 → 59 → 68 → 76 → 87 → 94**, one value every five seconds (about 35 seconds total). At 59 show MODERATE; at 76 show HIGH, OK → ALARM and the first Simulated SNS Notification. At 94 show CRITICAL, one escalation notification, and the Gazebo recommendation.
5. Leave the count at 94 for two more updates, or click **Simulate Critical Crowd** while already critical. Show that the selected location's notification count does not increase while ALARM persists.
6. Click **Normalize Crowd**. Watch **94 → 87 → 76 → 68 → 59 → 47 → 35**. At 68 show ALARM → OK, the recovery history, and that no duplicate SNS notifications appeared.
7. Optional: set evaluation to 2 to explain 2-of-2 observations. Pause metric ingestion, wait 20 seconds and show INSUFFICIENT_DATA. Resume ingestion to restore evaluation. Pausing affects monitoring ingestion only; the original dashboard continues updating.
8. Click **Resume live updates** and wait one update. Open Crowd Dashboard again to show the original application continues working.

Configuration and histories survive tab changes and page refresh because they are maintained in the backend. They reset on backend restart. Demo overrides and ingestion pause are shared by all viewers of this backend; changing the location selector does not automatically stop a running demo.

### AWS Mapping

| Local component | Actual AWS counterpart |
|---|---|
| `cloudWatchSimulator.observe` records zone population | Trusted backend publishes a custom metric using `PutMetricData` |
| Namespace, metric name, unit and Location dimension | CloudWatch custom metric identity and datapoints |
| `alarmEngine` with per-location configuration | `PutMetricAlarm` plus managed CloudWatch evaluation |
| Bounded transition history | CloudWatch alarm history / `DescribeAlarmHistory` |
| `notificationService` creates labeled local entries | CloudWatch alarm action targeting an SNS topic and confirmed subscriptions |
| Severity classification and graph-based recommendation | Application logic, optionally run by a backend or Lambda subscriber |

To connect real AWS later: send custom metrics from the backend with the AWS SDK and a least-privilege IAM role (`cloudwatch:PutMetricData`); provision alarms with supported AWS periods/statistics; create an SNS topic and confirm subscriptions; permit CloudWatch to publish to that topic; use authenticated admin controls and durable/shared storage where needed. The critical-escalation enhancement would need application publishing or a separate critical alarm. Never put AWS access keys in React code or GitHub. Deployment requires a Node backend supporting Socket.IO, MongoDB, a static frontend build with the deployed API/socket URLs, and suitable CORS settings. Multiple backend replicas would need shared monitoring state instead of these in-memory histories.

Official references: [CloudWatch concepts](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html), [CloudWatch alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Alarms.html), [PutMetricData](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricData.html), [Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html).

For concise viva answers, see [DA3_VIVA.md](DA3_VIVA.md).


### Saved Booking Crowd Monitoring

Every successfully saved booking is automatically registered with AWS Monitoring using the existing MongoDB Booking model. Saving opens the monitoring tab at that venue and selects the new event. The existing Bookings panel also has a **Monitor in AWS** link. Previously saved bookings are registered again when the backend reconnects on startup; their per-session alarm histories still reset on restart.

- **Upcoming:** armed until its scheduled start; no attendance notifications before the event.
- **Active:** evaluate the venue crowd every five seconds with a separate `BookingCrowdAlarm-<bookingId>` and `Location` plus `BookingId` dimensions. The default booking evaluation is 1-of-1, independent of the configurable location alarm.
- **Over planned attendance:** `CrowdCount > expectedAttendance` enters ALARM and records a **Simulated SNS Notification** with the event name, count, planned attendance, capacity, reason and recommendation.
- **Over venue capacity:** `CrowdCount > capacity` is CRITICAL. One capacity escalation notification can be generated if the event is already in ALARM. Repeated ALARM/CRITICAL observations are deduplicated within the episode.
- **Recovery:** when crowd returns to or below the planned limit and capacity, ALARM returns to OK; another later episode can notify again.
- **Completed/cancelled:** monitoring stops, current data is marked historical, and any booking-specific demo override is removed on the next generator update. Existing session history remains visible.
- **Missing venue observations:** the active booking alarm uses INSUFFICIENT_DATA after 20 seconds and withholds recommendations until fresh data returns.

Booking severity is relative to its plan: NORMAL below 80% of planned attendance, MODERATE from 80% through planned attendance, HIGH above planned attendance, and CRITICAL above venue capacity. The original location alarm and its absolute-count severity levels remain separate.

**Data limitation:** this project observes the whole venue count, not individually identified event attendees. Venue crowd is an attendance estimate and may include other people. All input remains simulated; no real AWS SNS delivery is claimed. Booking SNS actions are also mirrored into the existing alert bell/toasts as labeled simulated alerts, even when the AWS tab is closed (live Socket.IO mode).

**Booking demo:** create an event whose time window includes the current time, then save. In its Booked Event Monitoring section click **Crowd within booking**, **Simulate unexpected arrivals**, **Simulate capacity breach**, and **Normalize event crowd**. With planned attendance 100 in North Square (capacity 200), these presets demonstrate 80 → 100 → 101 → 120 for unexpected arrivals and 80 → 100 → 200 → 220 for capacity breach. Each value enters the original generator at five-second intervals. The final value holds, allowing you to demonstrate notification deduplication. Normalize to 80 to demonstrate recovery; then select **Return to live crowd**. Demo overrides are shared and modify the same venue count used by the dashboard and all active event/location alarms at that venue.

Monitoring snapshots at `GET /api/monitoring/:zoneId` now include `bookings` with each event's current status, metric identity, alarm, observations, transitions, recommendations and simulated SNS history. `POST /api/monitoring/:zoneId/bookings/:bookingId/demo` accepts `{"scenario":"within"}`, `surge`, `capacity` or `normalize`, and validates both the venue and the active booking time. Registration requires no new database schema, AWS credentials or runtime dependencies.
