import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { MessageController } from '../controllers/message.controller.js';

const router = Router();

router.use(verifyToken);

// Conversations
router.get('/conversations', MessageController.getConversations);
router.post('/conversations/direct', MessageController.getOrCreateDirectConversation);
router.post('/conversations/group', MessageController.createGroupConversation);
router.put('/conversations/:conversationId', MessageController.updateConversation);
router.delete('/conversations/:conversationId/leave', MessageController.leaveConversation);
router.post('/conversations/:conversationId/participants', MessageController.addParticipants);

// Messages
router.get('/conversations/:conversationId/messages', MessageController.getMessages);
router.get('/search', MessageController.searchMessages);

export default router;