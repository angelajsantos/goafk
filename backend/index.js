const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB!'))
    .catch((err) => console.log('MongoDB connection error:', err));

app.get('/', (req, res) => {
    res.json({ message: 'GoAFK API is running!' });
});

const PORT = process.env.PORT || 3001;

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});