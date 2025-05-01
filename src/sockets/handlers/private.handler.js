export const handlePrivateMessage = (io, socket, data) => {
    const { to, text } = data;
    io.to(to).emit('private-message', { from: socket.id, text });
  };