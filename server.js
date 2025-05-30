require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const WebSocket = require('ws');

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_CALLBACK_URL,
  SESSION_SECRET,
  WEB_PORT = 3001,
  MC_WS_IP = '0.0.0.0',
  MC_WS_PORT = 3000,
} = process.env;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Session middleware
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Discord OAuth2 strategy
passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
      scope: ['identify', 'guilds'],
    },
    (accessToken, refreshToken, profile, done) => {
      // Here you can save user info or do checks if you want
      return done(null, profile);
    }
  )
);

// Middleware to protect routes
function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Routes

app.get('/login', (req, res) => {
  // Simple login page with a Discord login button
  res.send(`
    <html><body style="background:#121212;color:#eee;font-family:sans-serif;text-align:center;padding:3rem;">
      <h1>Login with Discord</h1>
      <a href="/auth/discord"><button style="font-size:1.2rem;padding:1rem 2rem;cursor:pointer;">Login with Discord</button></a>
    </body></html>
  `);
});

app.get(
  '/auth/discord',
  passport.authenticate('discord')
);

app.get(
  '/auth/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

// Serve admin panel only if logged in
app.use('/', checkAuth, express.static(path.join(__dirname, 'public')));

// WebSocket server for Minecraft WS
const wss = new WebSocket.Server({ host: MC_WS_IP, port: MC_WS_PORT });

wss.on('listening', () => {
  console.log(`Minecraft WS Server listening on ws://${MC_WS_IP}:${MC_WS_PORT}`);
});

const mcClients = new Set();

wss.on('connection', (ws) => {
  console.log('Minecraft client connected');
  mcClients.add(ws);

  ws.on('message', (data) => {
    console.log('Message from Minecraft:', data);
    io.emit('mc-event', data);
  });

  ws.on('close', () => {
    console.log('Minecraft client disconnected');
    mcClients.delete(ws);
  });
});

// Share session with Socket.IO so you can optionally check login there too
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Socket.IO for web admin
io.on('connection', (socket) => {
  console.log('Web admin connected');

  socket.on('command', (cmd) => {
    console.log('Command from web admin:', cmd);
    mcClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ command: cmd }));
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Web admin disconnected');
  });
});

server.listen(WEB_PORT, () => {
  console.log(`Admin panel available at http://localhost:${WEB_PORT}`);
});
app.get('/me', checkAuth, (req, res) => {
  res.json({
    username: req.user.username,
    discriminator: req.user.discriminator,
    id: req.user.id
  });
});
