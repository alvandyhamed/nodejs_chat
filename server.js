import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- MongoDB Setup ---
mongoose.connect('mongodb://localhost:27017/chatApp')
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: null } // Store current socket ID if online
});
const User = mongoose.model('User', userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
    from: { type: String, required: true }, // Username of sender
    to: { type: String }, // Username of recipient (for private messages)
    type: { type: String, enum: ['private', 'group', 'channel'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // readBy: [{ type: String }] // Optional: Track who read the message (useful for group/channel)
});
const Message = mongoose.model('Message', messageSchema);

// Channel Schema
const channelSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true }, // Username of creator
    members: [{ type: String }] // Array of usernames
});
const Channel = mongoose.model('Channel', channelSchema);

// TODO: Add Channel schema later
// --- End MongoDB Setup ---

app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get and emit all users
async function emitAllUsers() {
    try {
        const allUsers = await User.find({}, 'username isOnline'); // Get username and online status
        io.emit('all-users', allUsers);
    } catch (err) {
        console.error('Error fetching or emitting users:', err);
    }
}

io.on('connection', (socket) => {
    console.log('یک کاربر متصل شد:', socket.id);

    socket.on('join-chat', async (username) => {
        if (!username || username.trim() === '') {
            // Optional: Add more validation for username if needed
            socket.emit('invalid-username', 'نام کاربری نمی‌تواند خالی باشد.');
            return; 
        }

        try {
            const user = await User.findOneAndUpdate(
                { username: username.trim() },
                { isOnline: true, socketId: socket.id },
                { upsert: true, new: true } // Create if not exists, return the new doc
            );
            console.log(`${user.username} joined with ID ${socket.id}`);
            
            // Join a room with the username for potential direct messaging later
            socket.join(user.username);
            // Maybe join a default 'group' room as well
            socket.join('group-chat'); 

            // --- Join Channel Rooms ---
            const userChannels = await Channel.find({ members: user.username });
            userChannels.forEach(channel => {
                const channelRoom = `channel-${channel.name}`;
                socket.join(channelRoom);
                console.log(`${user.username} joined channel room: ${channelRoom}`);
            });
            // --- End Join Channel Rooms ---

            // ارسال لیست کانال‌های کاربر
            socket.emit('user-channels', userChannels);

            // Emit updated user list to everyone
            await emitAllUsers();

            // --- Send Chat History ---
            // Fetch relevant private messages (sent to user or by user) and all group messages
            const historyMessages = await Message.find({
                $or: [
                    { type: 'private', to: user.username },
                    { type: 'private', from: user.username },
                    { type: 'group' },
                    { type: 'channel', to: { $in: userChannels.map(c => c.name) } } // Add channel messages
                ]
            }).sort({ timestamp: 1 }); // Sort by oldest first

            socket.emit('chat-history', historyMessages);
            console.log(`Sent chat history to ${user.username}`);
            // --- End Send Chat History ---

        } catch (err) {
            console.error('Error during join-chat:', err);
            socket.emit('join-error', 'خطا در ورود به چت.');
        }
    });

    // Handle Private Messages
    socket.on('private-message', async ({ to, message }) => {
        if (!to || !message || message.trim() === '') return;

        try {
            // Find sender from socket ID
            const senderUser = await User.findOne({ socketId: socket.id });
            if (!senderUser) return console.error('Sender not found for private message');
            const fromUsername = senderUser.username;

            // Save message to DB
            const newMessage = new Message({
                from: fromUsername,
                to: to,
                type: 'private',
                content: message.trim(),
            });
            await newMessage.save();
            console.log(`Private message saved: ${fromUsername} -> ${to}`);

            // Find recipient user
            const recipientUser = await User.findOne({ username: to });

            // Send to recipient if online
            if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                io.to(recipientUser.socketId).emit('private-message', {
                    from: fromUsername,
                    message: newMessage.content,
                    timestamp: newMessage.timestamp
                });
                console.log(`Sent real-time private message to ${to}`);
            } else {
                console.log(`Recipient ${to} is offline. Message stored.`);
            }

            // ارسال پیام به فرستنده هم (تا پیام خودش را ببیند)
            if (senderUser && senderUser.socketId) {
                io.to(senderUser.socketId).emit('private-message', {
                    from: fromUsername,
                    message: newMessage.content,
                    timestamp: newMessage.timestamp
                });
            }

        } catch (err) {
            console.error('Error handling private message:', err);
            socket.emit('message-error', 'خطا در ارسال پیام خصوصی.');
        }
    });

    // Handle Create Channel (Only User A)
    socket.on('create-channel', async (channelName) => {
        if (!channelName || channelName.trim() === '') return socket.emit('channel-error', 'نام کانال نمی‌تواند خالی باشد.');

        try {
            const user = await User.findOne({ socketId: socket.id });
            if (!user || user.username !== 'A') {
                return socket.emit('channel-error', 'فقط کاربر A می‌تواند کانال ایجاد کند.');
            }

            // Check if channel already exists
            const existingChannel = await Channel.findOne({ name: channelName.trim() });
            if (existingChannel) {
                return socket.emit('channel-error', 'کانالی با این نام وجود دارد.');
            }

            // Create and save new channel
            const newChannel = new Channel({
                name: channelName.trim(),
                createdBy: user.username, // User A
                members: [user.username] // Add creator as the first member
            });
            await newChannel.save();
            console.log(`Channel created: ${newChannel.name} by ${user.username}`);

            // Creator automatically joins the channel room
            const channelRoom = `channel-${newChannel.name}`;
            socket.join(channelRoom);
            console.log(`${user.username} joined newly created channel room: ${channelRoom}`);

            // Notify creator
            socket.emit('channel-created', newChannel);
            // ارسال لیست کانال‌های کاربر به‌روز شده
            socket.emit('user-channels', await Channel.find({ members: user.username }));

            // TODO: Maybe notify all users about the new channel?
            // emitAllChannels(); // We'll need a function like emitAllUsers for channels

        } catch (err) {
            console.error('Error creating channel:', err);
            socket.emit('channel-error', 'خطا در ایجاد کانال.');
        }
    });

    // Handle Add User to Channel (Only User A)
    socket.on('add-user-to-channel', async ({ channelName, usernameToAdd }) => {
        if (!channelName || !usernameToAdd) return socket.emit('channel-error', 'نام کانال و کاربر ضروری است.');

        try {
            const adminUser = await User.findOne({ socketId: socket.id });
            if (!adminUser || adminUser.username !== 'A') {
                return socket.emit('channel-error', 'فقط کاربر A می‌تواند کاربر به کانال اضافه کند.');
            }

            // Find the channel
            const channel = await Channel.findOne({ name: channelName });
            if (!channel) {
                return socket.emit('channel-error', 'کانال یافت نشد.');
            }

            // Find the user to add
            const userToAdd = await User.findOne({ username: usernameToAdd });
            if (!userToAdd) {
                return socket.emit('channel-error', 'کاربر مورد نظر یافت نشد.');
            }

            // Check if user is already a member
            if (channel.members.includes(usernameToAdd)) {
                return socket.emit('channel-error', 'کاربر از قبل عضو کانال است.');
            }

            // Add user to members and save
            channel.members.push(usernameToAdd);
            await channel.save();
            console.log(`${usernameToAdd} added to channel ${channelName} by ${adminUser.username}`);

            // Notify the admin
            socket.emit('user-added-to-channel', { channelName, username: usernameToAdd });

            // If the added user is online, make them join the room and notify them
            if (userToAdd.isOnline && userToAdd.socketId) {
                const targetSocket = io.sockets.sockets.get(userToAdd.socketId);
                if (targetSocket) {
                    const channelRoom = `channel-${channelName}`;
                    targetSocket.join(channelRoom);
                    targetSocket.emit('added-to-channel', { channelName: channel.name, addedBy: 'A' });
                    // ارسال لیست کانال‌های کاربر به‌روز شده
                    targetSocket.emit('user-channels', await Channel.find({ members: usernameToAdd }));
                    console.log(`Made ${usernameToAdd} join room ${channelRoom} and notified.`);
                }
            }

        } catch (err) {
            console.error('Error adding user to channel:', err);
            socket.emit('channel-error', 'خطا در افزودن کاربر به کانال.');
        }
    });

    // Handle Group Messages
    socket.on('group-message', async (message) => {
        if (!message || message.trim() === '') return;

        try {
            // Find sender from socket ID
            const senderUser = await User.findOne({ socketId: socket.id });
            if (!senderUser) return console.error('Sender not found for group message');
            const fromUsername = senderUser.username;

            // Save message to DB
            const newMessage = new Message({
                from: fromUsername,
                type: 'group',
                content: message.trim(),
            });
            await newMessage.save();
            console.log(`Group message saved from ${fromUsername}`);

            // Broadcast message to the group room
            io.to('group-chat').emit('group-message', {
                from: fromUsername,
                message: newMessage.content,
                timestamp: newMessage.timestamp
            });
            console.log(`Broadcasted group message to group-chat room`);

        } catch (err) {
            console.error('Error handling group message:', err);
            socket.emit('message-error', 'خطا در ارسال پیام گروهی.');
        }
    });

    // Handle Channel Messages (Only User A can send)
    socket.on('channel-message', async ({ channelName, message }) => {
        if (!channelName || !message || message.trim() === '') return socket.emit('channel-error', 'نام کانال و پیام ضروری است.');

        try {
            // Find sender
            const senderUser = await User.findOne({ socketId: socket.id });
            if (!senderUser) return console.error('Sender not found for channel message');

            // Check if sender is User A
            if (senderUser.username !== 'A') {
                return socket.emit('channel-error', 'فقط کاربر A می‌تواند در کانال پیام ارسال کند.');
            }

            // Find the channel to verify it exists (optional, but good practice)
            const channel = await Channel.findOne({ name: channelName });
            if (!channel) {
                return socket.emit('channel-error', 'کانال یافت نشد.');
            }

            // Save message to DB
            const newMessage = new Message({
                from: senderUser.username, // User A
                to: channelName, // Store channel name in 'to' field for channel messages
                type: 'channel',
                content: message.trim(),
            });
            await newMessage.save();
            console.log(`Channel message saved to ${channelName} from ${senderUser.username}`);

            // Broadcast message to the channel room
            const channelRoom = `channel-${channelName}`;
            io.to(channelRoom).emit('channel-message', {
                from: senderUser.username,
                channel: channelName,
                message: newMessage.content,
                timestamp: newMessage.timestamp
            });
            console.log(`Broadcasted channel message to room ${channelRoom}`);

        } catch (err) {
            console.error('Error handling channel message:', err);
            socket.emit('message-error', 'خطا در ارسال پیام کانال.');
        }
    });

    socket.on('disconnect', async () => {
        console.log('کاربر قطع اتصال شد:', socket.id);
        try {
            const user = await User.findOneAndUpdate(
                { socketId: socket.id }, 
                { isOnline: false, socketId: null },
                { new: false } // Return the old doc before update
            );

            if (user) {
                console.log(`${user.username} disconnected.`);
                 // Emit updated user list to everyone
                await emitAllUsers();
            } else {
                console.log('Disconnected user not found with socket ID:', socket.id);
            }
        } catch (err) {
            console.error('Error during disconnect:', err);
        }
    });
});

server.listen(3000, () => {
  console.log('سرور روی پورت 3000 اجرا شد: http://localhost:3000');
});