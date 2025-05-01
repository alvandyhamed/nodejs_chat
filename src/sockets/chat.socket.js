import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';
import { emitAllUsers } from '../controllers/chat.controller.js';

export default function chatSocket(io) {
    io.on('connection', (socket) => {
        console.log('یک کاربر متصل شد:', socket.id);

        socket.on('join-chat', async (username) => {
            if (!username || username.trim() === '') {
                socket.emit('invalid-username', 'نام کاربری نمی‌تواند خالی باشد.');
                return;
            }
            try {
                const user = await User.findOneAndUpdate(
                    { username: username.trim() },
                    { isOnline: true, socketId: socket.id },
                    { upsert: true, new: true }
                );
                socket.join(user.username);
                socket.join('group-chat');
                const userChannels = await Channel.find({ members: user.username });
                userChannels.forEach(channel => {
                    const channelRoom = `channel-${channel.name}`;
                    socket.join(channelRoom);
                });
                socket.emit('user-channels', userChannels);
                await emitAllUsers(io);
                const historyMessages = await Message.find({
                    $or: [
                        { type: 'private', to: user.username },
                        { type: 'private', from: user.username },
                        { type: 'group' },
                        { type: 'channel', to: { $in: userChannels.map(c => c.name) } }
                    ]
                }).sort({ timestamp: 1 });
                socket.emit('chat-history', historyMessages);
            } catch (err) {
                console.error('Error during join-chat:', err);
                socket.emit('join-error', 'خطا در ورود به چت.');
            }
        });

        socket.on('private-message', async ({ to, message }) => {
            if (!to || !message || message.trim() === '') return;
            try {
                const senderUser = await User.findOne({ socketId: socket.id });
                if (!senderUser) return;
                const fromUsername = senderUser.username;
                const newMessage = new Message({
                    from: fromUsername,
                    to: to,
                    type: 'private',
                    content: message.trim(),
                });
                await newMessage.save();
                const recipientUser = await User.findOne({ username: to });
                if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                    io.to(recipientUser.socketId).emit('private-message', {
                        from: fromUsername,
                        message: newMessage.content,
                        timestamp: newMessage.timestamp
                    });
                }
                if (senderUser && senderUser.socketId) {
                    io.to(senderUser.socketId).emit('private-message', {
                        from: fromUsername,
                        message: newMessage.content,
                        timestamp: newMessage.timestamp
                    });
                }
            } catch (err) {
                socket.emit('message-error', 'خطا در ارسال پیام خصوصی.');
            }
        });

        socket.on('create-channel', async (channelName) => {
            if (!channelName || channelName.trim() === '') return socket.emit('channel-error', 'نام کانال نمی‌تواند خالی باشد.');
            try {
                const user = await User.findOne({ socketId: socket.id });
                if (!user || user.username !== 'A') {
                    return socket.emit('channel-error', 'فقط کاربر A می‌تواند کانال ایجاد کند.');
                }
                const existingChannel = await Channel.findOne({ name: channelName.trim() });
                if (existingChannel) {
                    return socket.emit('channel-error', 'کانالی با این نام وجود دارد.');
                }
                const newChannel = new Channel({
                    name: channelName.trim(),
                    createdBy: user.username,
                    members: [user.username]
                });
                await newChannel.save();
                const channelRoom = `channel-${newChannel.name}`;
                socket.join(channelRoom);
                socket.emit('channel-created', newChannel);
                socket.emit('user-channels', await Channel.find({ members: user.username }));
            } catch (err) {
                socket.emit('channel-error', 'خطا در ایجاد کانال.');
            }
        });

        socket.on('add-user-to-channel', async ({ channelName, usernameToAdd }) => {
            if (!channelName || !usernameToAdd) return socket.emit('channel-error', 'نام کانال و کاربر ضروری است.');
            try {
                const adminUser = await User.findOne({ socketId: socket.id });
                if (!adminUser || adminUser.username !== 'A') {
                    return socket.emit('channel-error', 'فقط کاربر A می‌تواند کاربر به کانال اضافه کند.');
                }
                const channel = await Channel.findOne({ name: channelName });
                if (!channel) {
                    return socket.emit('channel-error', 'کانال یافت نشد.');
                }
                const userToAdd = await User.findOne({ username: usernameToAdd });
                if (!userToAdd) {
                    return socket.emit('channel-error', 'کاربر مورد نظر یافت نشد.');
                }
                if (channel.members.includes(usernameToAdd)) {
                    return socket.emit('channel-error', 'کاربر از قبل عضو کانال است.');
                }
                channel.members.push(usernameToAdd);
                await channel.save();
                socket.emit('user-added-to-channel', { channelName, username: usernameToAdd });
                if (userToAdd.isOnline && userToAdd.socketId) {
                    const targetSocket = io.sockets.sockets.get(userToAdd.socketId);
                    if (targetSocket) {
                        const channelRoom = `channel-${channelName}`;
                        targetSocket.join(channelRoom);
                        targetSocket.emit('added-to-channel', { channelName: channel.name, addedBy: 'A' });
                        targetSocket.emit('user-channels', await Channel.find({ members: usernameToAdd }));
                    }
                }
            } catch (err) {
                socket.emit('channel-error', 'خطا در افزودن کاربر به کانال.');
            }
        });

        socket.on('group-message', async (message) => {
            if (!message || message.trim() === '') return;
            try {
                const senderUser = await User.findOne({ socketId: socket.id });
                if (!senderUser) return;
                const fromUsername = senderUser.username;
                const newMessage = new Message({
                    from: fromUsername,
                    type: 'group',
                    content: message.trim(),
                });
                await newMessage.save();
                io.to('group-chat').emit('group-message', {
                    from: fromUsername,
                    message: newMessage.content,
                    timestamp: newMessage.timestamp
                });
            } catch (err) {
                socket.emit('message-error', 'خطا در ارسال پیام گروهی.');
            }
        });

        socket.on('channel-message', async ({ channelName, message }) => {
            if (!channelName || !message || message.trim() === '') return socket.emit('channel-error', 'نام کانال و پیام ضروری است.');
            try {
                const senderUser = await User.findOne({ socketId: socket.id });
                if (!senderUser) return;
                if (senderUser.username !== 'A') {
                    return socket.emit('channel-error', 'فقط کاربر A می‌تواند در کانال پیام ارسال کند.');
                }
                const channel = await Channel.findOne({ name: channelName });
                if (!channel) {
                    return socket.emit('channel-error', 'کانال یافت نشد.');
                }
                const newMessage = new Message({
                    from: senderUser.username,
                    to: channelName,
                    type: 'channel',
                    content: message.trim(),
                });
                await newMessage.save();
                const channelRoom = `channel-${channelName}`;
                io.to(channelRoom).emit('channel-message', {
                    from: senderUser.username,
                    channel: channelName,
                    message: newMessage.content,
                    timestamp: newMessage.timestamp
                });
            } catch (err) {
                socket.emit('message-error', 'خطا در ارسال پیام کانال.');
            }
        });

        socket.on('disconnect', async () => {
            try {
                const user = await User.findOneAndUpdate(
                    { socketId: socket.id },
                    { isOnline: false, socketId: null },
                    { new: false }
                );
                if (user) {
                    await emitAllUsers(io);
                }
            } catch (err) {
                console.error('Error during disconnect:', err);
            }
        });
    });
}
