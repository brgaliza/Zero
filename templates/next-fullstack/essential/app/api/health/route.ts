import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "not-configured" }, { status: 503 });
}
