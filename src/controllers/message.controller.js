import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';
import { getIO } from '../config/socket.js';

// ارسال پیام خصوصی
export async function sendPrivateMessage(req, res) {
    const { from, to, message, replyTo, forwardedFrom } = req.body;
    if (!from || !to || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        const newMessage = new Message({
            from,
            to,
            type: 'private',
            content: message.trim(),
            replyTo: replyTo || null,
            forwardedFrom: forwardedFrom || null,
        });
        await newMessage.save();
        const io = getIO();
        // ارسال به گیرنده آنلاین
        const recipientUser = await User.findOne({ username: to });
        console.log('recipientUser:', recipientUser);
        if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
            io.to(recipientUser.socketId).emit('private-message', {
                from,
                message: newMessage.content,
                timestamp: newMessage.timestamp,
                _id: newMessage._id,
                replyTo: newMessage.replyTo,
                forwardedFrom: newMessage.forwardedFrom,
                type: 'private',
                likes: newMessage.likes || [],
            });
            console.log('پیام به گیرنده ارسال شد');
        } else {
            console.log('گیرنده آنلاین نیست یا پیدا نشد');
        }
        // ارسال به فرستنده
        const senderUser = await User.findOne({ username: from });
        console.log('senderUser:', senderUser);
        if (senderUser && senderUser.socketId) {
            io.to(senderUser.socketId).emit('private-message', {
                from,
                message: newMessage.content,
                timestamp: newMessage.timestamp,
                _id: newMessage._id,
                replyTo: newMessage.replyTo,
                forwardedFrom: newMessage.forwardedFrom,
                type: 'private',
                likes: newMessage.likes || [],
            });
            console.log('پیام به فرستنده ارسال شد');
        } else {
            console.log('فرستنده پیدا نشد یا socketId ندارد');
        }
        res.json({ success: true, messageId: newMessage._id });
    } catch (err) {
        console.error('خطا در ارسال پیام خصوصی:', err);
        res.status(500).json({ error: 'خطا در ارسال پیام خصوصی.' });
    }
}

// ارسال پیام گروهی
export async function sendGroupMessage(req, res) {
    const { from, message, replyTo, forwardedFrom } = req.body;
    if (!from || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        const newMessage = new Message({
            from,
            type: 'group',
            content: message.trim(),
            replyTo: replyTo || null,
            forwardedFrom: forwardedFrom || null,
        });
        await newMessage.save();
        const io = getIO();
        io.to('group-chat').emit('group-message', {
            from,
            message: newMessage.content,
            timestamp: newMessage.timestamp,
            _id: newMessage._id,
            replyTo: newMessage.replyTo,
            forwardedFrom: newMessage.forwardedFrom,
            type: 'group',
        });
        res.json({ success: true, messageId: newMessage._id });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ارسال پیام گروهی.' });
    }
}

// ارسال پیام کانال
export async function sendChannelMessage(req, res) {
    const { from, channelName, message, replyTo, forwardedFrom } = req.body;
    if (!from || !channelName || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        if (from !== 'A') return res.status(403).json({ error: 'فقط کاربر A می‌تواند پیام کانال ارسال کند.' });
        const channel = await Channel.findOne({ name: channelName });
        if (!channel) return res.status(404).json({ error: 'کانال یافت نشد.' });
        const newMessage = new Message({
            from,
            to: channelName,
            type: 'channel',
            content: message.trim(),
            replyTo: replyTo || null,
            forwardedFrom: forwardedFrom || null,
        });
        await newMessage.save();
        const io = getIO();
        const channelRoom = `channel-${channelName}`;
        io.to(channelRoom).emit('channel-message', {
            from,
            channel: channelName,
            message: newMessage.content,
            timestamp: newMessage.timestamp,
            _id: newMessage._id,
            replyTo: newMessage.replyTo,
            forwardedFrom: newMessage.forwardedFrom,
            type: 'channel',
        });
        res.json({ success: true, messageId: newMessage._id });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ارسال پیام کانال.' });
    }
}

// لایک پیام
export async function likeMessage(req, res) {
    const { id } = req.params;
    const { username } = req.body;
    if (!id || !username) return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        const msg = await Message.findById(id);
        if (!msg) return res.status(404).json({ error: 'پیام یافت نشد.' });
        if (!msg.likes.includes(username)) {
            msg.likes.push(username);
            await msg.save();
            const io = getIO();
            // رویداد لایک شدن پیام
            io.emit('message-liked', { messageId: id, username, likes: msg.likes });
        }
        res.json({ success: true, likes: msg.likes });
    } catch (err) {
        res.status(500).json({ error: 'خطا در لایک پیام.' });
    }
} 