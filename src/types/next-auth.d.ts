import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    accessToken?: string;
    role?: 'ADMIN' | 'USER';
  }

  interface User {
    role?: 'ADMIN' | 'USER';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    accessToken?: string;
    role?: 'ADMIN' | 'USER';
  }
}
