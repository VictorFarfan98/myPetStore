import { NextResponse } from "next/server";
import { getAppData } from "@/lib/app-data";

export async function GET() {
  const data = await getAppData();
  return NextResponse.json(data);
}
