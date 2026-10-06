import { createServerAuth } from "@/lib/neon/auth-server";

function handlers() {
  return createServerAuth().handler();
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handlers().GET(request, context);
}
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handlers().POST(request, context);
}
export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handlers().PUT(request, context);
}
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handlers().DELETE(request, context);
}
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handlers().PATCH(request, context);
}
