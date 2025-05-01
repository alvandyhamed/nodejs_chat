import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import chatSocket from './sockets/chat.socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// اتصال به دیتابیس
connectDB();

// فایل‌های استاتیک
app.use(express.static(path.join(__dirname, '../public')));

// راه‌اندازی سوکت
chatSocket(io);

export { app, server };
