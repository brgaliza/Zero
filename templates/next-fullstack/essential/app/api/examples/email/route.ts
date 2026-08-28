import { NextResponse } from "next/server";
import { sendExampleEmail } from "../../../lib/email";

export async function POST() {
  try {
    await sendExampleEmail();
    return NextResponse.json({ status: "sent", recipient: "demo@local.test" });
  } catch {
    return NextResponse.json({ error: "E-mail indisponível." }, { status: 503 });
  }
}
