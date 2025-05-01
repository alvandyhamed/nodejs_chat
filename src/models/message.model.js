import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String },
    type: { type: String, enum: ['private', 'group', 'channel'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // readBy: [{ type: String }]
});

const Message = mongoose.model('Message', messageSchema);
export default Message;
