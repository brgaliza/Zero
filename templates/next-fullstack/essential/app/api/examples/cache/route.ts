import { NextResponse } from "next/server";
import { cacheExample } from "../../../lib/cache";

export async function GET() {
  try {
    return NextResponse.json(await cacheExample());
  } catch {
    return NextResponse.json({ error: "Cache indisponível." }, { status: 503 });
  }
}
