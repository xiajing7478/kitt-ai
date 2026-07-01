export type UserRecord = {
  id: number;
  username: string;
  email: string;
  password: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export type SafeUser = Omit<UserRecord, 'password'>;
