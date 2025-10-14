// routes/users.js
import express from 'express';
import { registerUser, loginUser, getUsers} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);

router.post('/register', registerUser);
router.post('/login', loginUser);

export default router;