import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
});

export interface UserDoc {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

export const User = mongoose.model<UserDoc>('User', userSchema);
