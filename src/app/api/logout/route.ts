import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("pf_auth");
  return NextResponse.redirect(new URL("/login", req.url));
}
