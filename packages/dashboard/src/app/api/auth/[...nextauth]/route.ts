import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { initUsersDb, getUserByEmail, createUser } from "@/lib/db";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (user.email && account?.providerAccountId) {
        try {
          const db = initUsersDb();
          let existingUser = getUserByEmail(db, user.email);
          if (!existingUser) {
            createUser(db, user.email, account.providerAccountId);
          }
          db.close();
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        try {
          const db = initUsersDb();
          const existingUser = getUserByEmail(db, session.user.email);
          if (existingUser) {
            (session as any).apiToken = existingUser.api_token;
            (session as any).configSettings = existingUser.config_settings;
          }
          db.close();
        } catch (error) {
          console.error("Error in session callback:", error);
        }
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST };
