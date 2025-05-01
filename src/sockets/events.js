import { handlePrivateMessage } from './handlers/private.handler.js';
import { handleGroupMessage } from './handlers/group.handler.js';

export const bindSocketEvents = (io) => {
  io.on('connection', (socket) => {
    socket.on('private-message', (data) => handlePrivateMessage(io, socket, data));
    socket.on('group-message', (data) => handleGroupMessage(io, socket, data));
  });
};