import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { db } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../middleware/errorHandler';

export const authService = {
  async login(username: string, password: string) {
    const result = await db.query(
      'SELECT id, username, password_hash, first_name, last_name, role, is_active FROM users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as StringValue }
    );

    const { password_hash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  },
};
