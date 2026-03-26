const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        const approvedOrigins = [...defaultAllowedOrigins, ...allowedOrigins];
        if (approvedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
};

app.use(cors(corsOptions));
app.use(express.json());

// connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB!'))
    .catch((err) => console.log('MongoDB connection error:', err));

app.get('/', (req, res) => {
    res.json({ message: 'GoAFK API is running!' });
});

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
