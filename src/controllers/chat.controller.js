import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';

// این فایل فقط توابع کمکی و منطق چت را نگه می‌دارد
// هندلینگ سوکت در فایل sockets/chat.socket.js انجام می‌شود

export async function emitAllUsers(io) {
    try {
        const allUsers = await User.find({}, 'username isOnline');
        io.emit('all-users', allUsers);
    } catch (err) {
        console.error('Error fetching or emitting users:', err);
    }
}

// سایر توابع کمکی (در صورت نیاز) اینجا اضافه می‌شود
