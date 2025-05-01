# Socket.io Features & Events in This Project

> [Back to Main README](./README.md)

This document lists **all Socket.io features and events** implemented in this project, with very simple explanations for each function and event. You can link to this file from the main README for detailed reference.

---

## Main Socket.io Methods Used

### 1. `io.on('connection', callback)`
- **What it does:** Listens for new users connecting to the server.
- **Why used:** To set up all chat features for each new user as soon as they join.

### 2. `socket.on('event', callback)`
- **What it does:** Listens for a specific event (like a message or action) from the client.
- **Why used:** To react to user actions, like sending a message, joining a chat, etc.

### 3. `socket.emit('event', data)`
- **What it does:** Sends an event and data to the connected client only.
- **Why used:** To send a response or update to the user who triggered an action (e.g., error messages, chat history).

### 4. `io.emit('event', data)`
- **What it does:** Sends an event and data to **all** connected clients.
- **Why used:** To update everyone at once (e.g., when a message is liked).

### 5. `io.to(room).emit('event', data)`
- **What it does:** Sends an event and data to all users in a specific room (group, channel, or private chat).
- **Why used:** To send messages only to relevant users (e.g., group messages, channel messages).

### 6. `socket.join(room)`
- **What it does:** Adds the user to a specific room (like a group or channel).
- **Why used:** So the user receives messages for that room only.

### 7. `socket.leave(room)`
- **What it does:** Removes the user from a room.
- **Why used:** (Not used much in this project, but useful for leaving channels/groups.)

---

## Custom Events Used in This Project

### User Connection & Presence
- **`join-chat`**: User joins the chat. Server sets them online, sends their chat history and channels.
- **`disconnect`**: User leaves the chat. Server marks them offline and updates user lists.

### Messaging
- **`private-message`**: Send a private message to another user.
- **`group-message`**: Send a message to all users in the group chat.
- **`channel-message`**: Send a message to all users in a specific channel (only user A can do this).
- **`read-private-messages`**: Mark private messages as read and notify the sender.

### Channel Management
- **`create-channel`**: Create a new channel (only user A).
- **`add-user-to-channel`**: Add a user to a channel (only user A).

### Server-to-Client Events (Emitted)
- **`invalid-username`**: Username is invalid.
- **`user-channels`**: List of channels the user is a member of.
- **`chat-history`**: Full chat history for the user.
- **`private-message`**: Receive a private message.
- **`private-message-status`**: Status of a private message (sent, delivered, read).
- **`group-message`**: Receive a group message.
- **`channel-created`**: Channel was created successfully.
- **`user-added-to-channel`**: User was added to a channel.
- **`added-to-channel`**: You were added to a channel.
- **`channel-message`**: Receive a channel message.
- **`all-users`**: List of all users and their online/offline status.
- **`message-liked`**: A message was liked (like count updated).
- **`join-error`, `message-error`, `channel-error`**: Error messages for various actions.

---

## Simple Explanations for Each Event/Function

### `on`
- **What it does:** Listens for an event from the client or server.
- **Why used:** To react to things users do (like sending a message, joining, etc.).
- **Example:**
  ```js
  socket.on('private-message', (data) => { /* handle message */ });
  ```

### `emit`
- **What it does:** Sends an event to the client or server.
- **Why used:** To notify users about something (like a new message, error, etc.).
- **Example:**
  ```js
  socket.emit('chat-history', messages);
  ```

### `join`
- **What it does:** Puts a user in a room (group, channel, etc.).
- **Why used:** So they get messages for that room only.
- **Example:**
  ```js
  socket.join('group-chat');
  ```

### `to(...).emit`
- **What it does:** Sends an event to all users in a specific room.
- **Why used:** To send group or channel messages only to relevant users.
- **Example:**
  ```js
  io.to('group-chat').emit('group-message', {...});
  ```

### `disconnect`
- **What it does:** Triggered when a user leaves the chat.
- **Why used:** To update their status and inform others.

---

## Why These Features?
- **Rooms:** To separate private, group, and channel chats.
- **Events:** To handle every action in real-time (join, message, like, etc.).
- **Status Updates:** So users always see who is online and the status of their messages.

---

For more details, see the [main README](./README.md) or check the code in `src/sockets/chat.socket.js`. 