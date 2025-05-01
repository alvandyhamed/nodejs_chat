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
                const undelivered = await Message.find({
                    to: user.username,
                    type: 'private',
                    status: 'sent'
                });
                for (const msg of undelivered) {
                    msg.status = 'delivered';
                    await msg.save();
                    console.log('join-chat delivered:', msg._id.toString(), msg.status);
                    const senderUser = await User.findOne({ username: msg.from });
                    if (senderUser && senderUser.socketId) {
                        io.to(senderUser.socketId).emit('private-message-status', {
                            messageId: msg._id,
                            status: 'delivered'
                        });
                    }
                }
                const historyMessages = await Message.find({
                    $or: [
                        { type: 'private', to: user.username },
                        { type: 'private', from: user.username },
                        { type: 'group' },
                        { type: 'channel', to: { $in: userChannels.map(c => c.name) } }
                    ]
                }).sort({ timestamp: 1 });
                const fixedHistory = historyMessages.map(msg => ({
                    _id: msg._id?.toString() || '',
                    from: msg.from || 'نامشخص',
                    content: msg.content || msg.message || '',
                    likes: Array.isArray(msg.likes) ? msg.likes : [],
                    replyTo: msg.replyTo || null,
                    forwardedFrom: msg.forwardedFrom || null,
                    type: msg.type || '',
                    to: msg.to || '',
                    timestamp: msg.timestamp || '',
                    status: msg.status || 'sent',
                }));
                console.log('chat-history to', user.username, fixedHistory);
                socket.emit('chat-history', fixedHistory);
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
                const recipientUser = await User.findOne({ username: to });
                let status = 'sent';
                if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                    status = 'delivered';
                }
                const newMessage = new Message({
                    from: fromUsername,
                    to: to,
                    type: 'private',
                    content: message.trim(),
                    status
                });
                await newMessage.save();
                if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                    io.to(recipientUser.socketId).emit('private-message', {
                        from: fromUsername,
                        message: newMessage.content,
                        timestamp: newMessage.timestamp,
                        _id: newMessage._id,
                        status: newMessage.status
                    });
                    io.to(senderUser.socketId).emit('private-message-status', {
                        messageId: newMessage._id,
                        status: 'delivered'
                    });
                } else {
                    io.to(senderUser.socketId).emit('private-message-status', {
                        messageId: newMessage._id,
                        status: 'sent'
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
                    timestamp: newMessage.timestamp,
                    _id: newMessage._id,
                    replyTo: newMessage.replyTo,
                    forwardedFrom: newMessage.forwardedFrom,
                    type: 'group',
                    likes: newMessage.likes || [],
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
                    timestamp: newMessage.timestamp,
                    _id: newMessage._id,
                    replyTo: newMessage.replyTo,
                    forwardedFrom: newMessage.forwardedFrom,
                    type: 'channel',
                    likes: newMessage.likes || [],
                });
            } catch (err) {
                socket.emit('message-error', 'خطا در ارسال پیام کانال.');
            }
        });

        socket.on('read-private-messages', async ({ from, to }) => {
            if (!from || !to) return;
            try {
                const unreadMsgs = await Message.find({ from, to, type: 'private', status: 'delivered' });
                for (const msg of unreadMsgs) {
                    msg.status = 'read';
                    await msg.save();
                    console.log('read-private-messages read:', msg._id.toString(), msg.status);
                    const senderUser = await User.findOne({ username: from });
                    if (senderUser && senderUser.socketId) {
                        io.to(senderUser.socketId).emit('private-message-status', {
                            messageId: msg._id,
                            status: 'read'
                        });
                    }
                }
            } catch (err) {
                console.error('Error in read-private-messages:', err);
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
