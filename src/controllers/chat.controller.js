import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';



export async function emitAllUsers(io) {
    try {
        const allUsers = await User.find({}, 'username isOnline');
        io.emit('all-users', allUsers);
    } catch (err) {
        console.error('Error fetching or emitting users:', err);
    }
}


