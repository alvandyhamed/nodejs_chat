export const handleGroupMessage = (io, socket, data) => {
    const { groupId, text } = data;
    io.to(groupId).emit('group-message', { from: socket.id, text });
  };