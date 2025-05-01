import express from 'express';
import { sendPrivateMessage, sendGroupMessage, sendChannelMessage } from '../controllers/message.controller.js';

const router = express.Router();

// ارسال پیام خصوصی
router.post('/message/private', sendPrivateMessage);
// ارسال پیام گروهی
router.post('/message/group', sendGroupMessage);
// ارسال پیام کانال
router.post('/message/channel', sendChannelMessage);

export default router;
