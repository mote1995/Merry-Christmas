const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = 'merry_christmas_2025'; // Basic security token

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const auth = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(403).json({ success: false, message: 'Unauthorized' });
  next();
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directories exist
const uploadDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Root Route for verification
app.get('/', (req, res) => {
  res.send('<h1>🎄 Christmas Tree Backend is running!</h1><p>API endpoints are active.</p>');
});

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// API: Upload Image
app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

// API: Save Record
app.post('/api/records', auth, (req, res) => {
  const id = uuidv4();
  const filePath = path.join(dataDir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(req.body));
  res.json({ success: true, id });
});

// API: Get Record (Open to read)
app.get('/api/records/:id', (req, res) => {
  const filePath = path.join(dataDir, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Not found' });
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);
});

// API: Update Record
app.put('/api/records/:id', auth, (req, res) => {
  const filePath = path.join(dataDir, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Not found' });
  fs.writeFileSync(filePath, JSON.stringify(req.body));
  res.json({ success: true, id: req.params.id });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NAS Backend running on http://0.0.0.0:${PORT}`);
});
