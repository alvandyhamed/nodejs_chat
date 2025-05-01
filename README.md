# Socket.io Chat App

## 1. Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally or on a server)
- (Optional) Redis for caching or scaling

### Installation & Run

1. Clone the repository or download the files.
2. Open a terminal and navigate to the project directory:
   ```bash
   cd socket-chat-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Make sure MongoDB is running (default: `mongodb://localhost:27017/`).
5. Start the server:
   ```bash
   node server.js
   ```
   or for development:
   ```bash
   npx nodemon server.js
   ```
6. Open your browser and go to:
   ```
   http://localhost:3000
   ```
7. Enter one of the usernames: `A`, `B`, or `C` to join the chat.

---

## 2. Scenario & Architecture

### Project Goal
A real-time chat system with private, group, and channel chat features, online/offline user management, and advanced features like like, reply, and forward messages.

### Database Role (MongoDB)
- **User**: Stores username, online status, and current socketId.
- **Message**: Stores messages with sender, recipient, type (private, group, channel), timestamp, status (sent, delivered, read), likes, reply, and forward info.
- **Channel**: Stores channels with name, creator, and members.

### Socket Role (Socket.io)
- Manages user connections/disconnections
- Real-time message delivery (private, group, channel)
- Handles events like channel creation, adding users to channels, updating message status (delivered/read), sending chat history, etc.
- Notifies about user online/offline status

---

## 3. Chat Scenario & Socket.io Features (Step by Step)

> **For a full list and simple explanations of all Socket.io features and events used in this project, see [SOCKET_FEATURES.md](./SOCKET_FEATURES.md).**

### Login & Connection
- User enters a username (`A`, `B`, or `C`) to join.
- `join-chat` event is sent to the server.
- Server marks the user as online, joins them to relevant rooms (private, group, channels), and sends chat history and their channel list.

### Private Chat
- User selects a recipient from the online/offline user list.
- Private message is sent via `private-message` event.
- If the recipient is online, the message is delivered with `delivered` status and sender is notified.
- If the recipient is offline, the message is stored with `sent` status and delivered when they come online.
- Message status (delivered/read) is updated via separate events.

### Group Chat
- All users are members of the group room.
- Group messages are sent via `group-message` event and broadcast to all members.

### Channel
- Only user `A` can create new channels (`create-channel`).
- Only user `A` can add users to a channel (`add-user-to-channel`).
- Only user `A` can send messages in a channel (`channel-message`).
- Each user only sees messages from channels they are a member of.

### Advanced Message Features
- **Reply:** Any message can be replied to. The replied message is referenced in the new message.
- **Forward:** Any message can be forwarded to a private chat, group, or another channel.
- **Like:** Any message can be liked. Like count is shown next to the message and updated in real-time (`message-liked` event).
- **Message Status (Tick):** Private messages have sent/delivered/read status, updated via separate events.

### User Management
- Online/offline user list is updated in real-time (`all-users`).
- On disconnect, user is marked offline and the list is updated.

### Chat History
- On login, the full chat history (private, group, channel) is sent to the user (`chat-history`).
- New messages are added to the UI in real-time.

---

## 4. Folder Structure (Summary)

```
src/
  models/        Database models (User, Message, Channel)
  sockets/       Socket logic and chat events
  controllers/   API controllers and message logic
  routes/        API routes
  config/        DB and socket configuration
public/
  index.html     Login page
  chat.html      Chat UI
  styles.css     UI styles
server.js        Server entry point
package.json     Dependencies
```

---

## 5. Additional Notes

- For best testing, open several tabs or browsers and log in with different usernames.
- Only user `A` can create channels and send channel messages.
- Private, group, and channel chats each have their own tab in the UI.
- Advanced features (reply, forward, like) are available in the chat UI.

---

Feel free to ask for more details about any part or specific code section! 