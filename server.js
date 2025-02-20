const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
    email: String,
    password: String, // Hashed
    balance: { type: Number, default: 0 },
    binancePayId: String,
    watchedAds: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// Ad Schema
const AdSchema = new mongoose.Schema({
    title: String,
    url: String,
    reward: Number
});
const Ad = mongoose.model('Ad', AdSchema);

// Register User
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });
    
    const user = new User({ email, password, balance: 0, watchedAds: 0 });
    await user.save();
    res.json({ message: "User registered successfully" });
});

// Deposit USDT via Binance Pay API
app.post('/deposit', async (req, res) => {
    const { email, amount } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    
    try {
        const response = await axios.post('https://api.binance.com/sapi/v1/pay/transactions', {
            amount,
            currency: 'USDT',
            email
        }, {
            headers: {
                'X-MBX-APIKEY': process.env.BINANCE_API_KEY
            }
        });
        
        if (response.data.status === 'SUCCESS') {
            user.balance += amount;
            await user.save();
            res.json({ message: "Deposit successful", balance: user.balance });
        } else {
            res.status(400).json({ message: "Deposit failed" });
        }
    } catch (error) {
        res.status(500).json({ message: "Binance Pay error", error: error.response?.data || error.message });
    }
});

// Get User Balance
app.get('/balance/:email', async (req, res) => {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.json({ balance: user.balance });
});

// Get Available Ads
app.get('/ads', async (req, res) => {
    const ads = await Ad.find();
    res.json(ads);
});

// Watch Ad and Earn Rewards
app.post('/watch-ad', async (req, res) => {
    const { email, adId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    
    const ad = await Ad.findById(adId);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    
    user.balance += ad.reward;
    user.watchedAds += 1;
    await user.save();
    
    res.json({ message: "Ad watched successfully", balance: user.balance, watchedAds: user.watchedAds });
});

// Admin: Add New Ad
app.post('/admin/add-ad', async (req, res) => {
    const { title, url, reward } = req.body;
    const newAd = new Ad({ title, url, reward });
    await newAd.save();
    res.json({ message: "Ad added successfully" });
});

// Admin: Delete Ad
app.delete('/admin/delete-ad/:id', async (req, res) => {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: "Ad deleted successfully" });
});

// Admin: Update Ad
app.put('/admin/update-ad/:id', async (req, res) => {
    const { title, url, reward } = req.body;
    await Ad.findByIdAndUpdate(req.params.id, { title, url, reward });
    res.json({ message: "Ad updated successfully" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
