import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    members: [{ type: String }]
});

const Channel = mongoose.model('Channel', channelSchema);
export default Channel;
