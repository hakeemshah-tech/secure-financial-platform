import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import { getUsers, toggleBlockUser, deleteUser, getUserById, updateUserWallet } from '../controllers/userController';

const router = express.Router();

router.route('/')
    .get(protect, admin, getUsers);

router.route('/:id')
    .get(protect, admin, getUserById)
    .delete(protect, admin, deleteUser);

router.route('/:id/block')
    .patch(protect, admin, toggleBlockUser);

router.route('/:id/wallet')
    .patch(protect, admin, updateUserWallet);

export default router;
