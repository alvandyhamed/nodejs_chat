import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';
import { getIO } from '../config/socket.js';

// ارسال پیام خصوصی
export async function sendPrivateMessage(req, res) {
    const { from, to, message } = req.body;
    if (!from || !to || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        const newMessage = new Message({
            from,
            to,
            type: 'private',
            content: message.trim(),
        });
        await newMessage.save();
        const io = getIO();
        // ارسال به گیرنده آنلاین
        const recipientUser = await User.findOne({ username: to });
        if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
            io.to(recipientUser.socketId).emit('private-message', {
                from,
                message: newMessage.content,
                timestamp: newMessage.timestamp
            });
        }
        // ارسال به فرستنده
        const senderUser = await User.findOne({ username: from });
        if (senderUser && senderUser.socketId) {
            io.to(senderUser.socketId).emit('private-message', {
                from,
                message: newMessage.content,
                timestamp: newMessage.timestamp
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ارسال پیام خصوصی.' });
    }
}

// ارسال پیام گروهی
export async function sendGroupMessage(req, res) {
    const { from, message } = req.body;
    if (!from || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        const newMessage = new Message({
            from,
            type: 'group',
            content: message.trim(),
        });
        await newMessage.save();
        const io = getIO();
        io.to('group-chat').emit('group-message', {
            from,
            message: newMessage.content,
            timestamp: newMessage.timestamp
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ارسال پیام گروهی.' });
    }
}

// ارسال پیام کانال
export async function sendChannelMessage(req, res) {
    const { from, channelName, message } = req.body;
    if (!from || !channelName || !message || message.trim() === '') return res.status(400).json({ error: 'پارامترها ناقص است.' });
    try {
        // فقط کاربر A مجاز است
        if (from !== 'A') return res.status(403).json({ error: 'فقط کاربر A می‌تواند پیام کانال ارسال کند.' });
        const channel = await Channel.findOne({ name: channelName });
        if (!channel) return res.status(404).json({ error: 'کانال یافت نشد.' });
        const newMessage = new Message({
            from,
            to: channelName,
            type: 'channel',
            content: message.trim(),
        });
        await newMessage.save();
        const io = getIO();
        const channelRoom = `channel-${channelName}`;
        io.to(channelRoom).emit('channel-message', {
            from,
            channel: channelName,
            message: newMessage.content,
            timestamp: newMessage.timestamp
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ارسال پیام کانال.' });
    }
} 