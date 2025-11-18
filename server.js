// server.js with free Gemini model and optimizations
require('dotenv').config();
console.log("GEMINI:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing");
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');

const User = require('./models/User');
const Order = require('./models/Order');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine and static files
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---- MongoDB ----
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Mongo connected'))
  .catch((err) => console.error('Mongo connection error:', err));

// ---- Session ----
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 14,
    }),
  })
);

// ---- Passport ----
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email,
            name: profile.displayName,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ---- Middleware ----
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();

  // Detect AJAX/fetch requests
  const wantsJson =
    req.xhr ||
    req.headers.accept.indexOf('json') > -1 ||
    req.headers['content-type'] === 'application/json';

  if (wantsJson) {
    return res.status(401).json({ error: 'Login required' });
  }

  // Normal browser request
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/login');

  const adminList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase());

  if (adminList.includes((req.user.email || '').toLowerCase())) return next();
  return res.status(403).send('Restricted — admin access only');
}

// ---- Routes ----
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
  res.render('login');
});

// Google Login
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {});
  res.redirect('/');
});
app.get('/cart', ensureAuth, (req, res) => {
  res.render('cart', { user: req.user });
});

// ---- Custom Order API ----
app.post('/api/custom-order', ensureAuth, async (req, res) => {
  try {
    const { title, description } = req.body;

    const order = await Order.create({
      userId: req.user._id,
      userEmail: req.user.email,
      title: title || 'Custom Cup',
      description: description || '',
      status: 'not viewed',
      createdAt: new Date(),
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const adminList = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .join(',');

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: adminList,
      subject: `New custom order — ${order.title}`,
      text: `A new custom order was placed by ${req.user.email}
Title: ${order.title}
Description: ${order.description}
Manage at /admin`,
    });

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ---- Gemini Proxy (FREE, less used model) ----
// Using gemini-1.5-flash-8b — VERY fast, VERY cheap, not heavily used


// ---- Gemini Proxy (FREE MODEL) ----
// ---- Gemini Proxy (FREE MODEL) ----
// ---- Gemini Proxy (FREE MODEL) ----
app.post('/api/gemini', ensureAuth, async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    const prompt = req.body.prompt;

    if (!API_KEY) {
      return res.status(400).json({ error: 'Missing API key' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const response = await axios.post(url, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });

    // Extract raw text
    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    return res.send(text); // 👈 returns only plain string
  } catch (err) {
    console.error("Gemini error:", err.response?.data || err.message);
    res.status(500).send("Gemini failed");
  }
});

// ---- Custom Page ----
app.get('/custom', (req, res) => {
  res.render('custom', { user: req.user });
});

// ---- Admin Panel ----
app.get('/admin', async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(200);
  res.render('admin', { user: req.user, orders });
});

app.post('/admin/order/:id/update', async (req, res) => {
  const { id } = req.params;
  const { action, price, comments } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).send('Order not found');

  if (action === 'approve') {
    order.status = 'approved';
    order.price = price || order.price;
    order.comments = comments || order.comments;
  } else if (action === 'disapprove') {
    order.status = 'disapproved';
    order.comments = comments || order.comments;
  }

  await order.save();
  res.redirect('/admin');
});

// ---- User Orders ----
app.get('/api/my-orders', ensureAuth, async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// ---- Start ----
app.listen(PORT, () => console.log(`Server running on ${PORT}`));