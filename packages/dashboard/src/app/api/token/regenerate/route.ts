import { NextResponse } from "next-auth/next";
import { getServerSession } from "next-auth/next";
import { initUsersDb, regenerateUserToken, getUserByEmail } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const db = initUsersDb();
    const user = getUserByEmail(db, session.user.email);
    
    if (!user) {
      db.close();
      return new Response("User not found", { status: 404 });
    }

    const newToken = regenerateUserToken(db, user.id);
    db.close();

    return Response.json({ success: true, token: newToken });
  } catch (error) {
    console.error("Error regenerating token:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
