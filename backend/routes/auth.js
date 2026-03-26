const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// sign up
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        console.log('Signup attempt:', { username, email }) // add this line
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user._id, username: user.username });
    } catch (err) {
        console.log('Signup error:', err.message) // add this line
        res.status(400).json({ error: err.message });
    }
});

// login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', email)
        const user = await User.findOne({ email });
        console.log('User found:', user ? 'yes' : 'no')
        if (!user) return res.status(400).json({ error: 'User not found' });
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch)
        if (!isMatch) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        console.log('Token created:', token ? 'yes' : 'no')
        res.json({ token, userId: user._id, username: user.username });
    } catch (err) {
        console.log('Login error:', err.message)
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;