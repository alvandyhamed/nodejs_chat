import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: null }
});

const User = mongoose.model('User', userSchema);
export default User;
