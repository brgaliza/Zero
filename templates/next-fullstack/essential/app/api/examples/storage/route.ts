import { NextResponse } from "next/server";
import { listExamples, putExample } from "../../../lib/storage";

export async function GET() {
  try {
    return NextResponse.json({ items: await listExamples() });
  } catch {
    return NextResponse.json({ error: "Storage indisponível." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 });
    return NextResponse.json(await putExample(file), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }
}
