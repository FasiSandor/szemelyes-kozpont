import { createServerAuth } from "@/lib/neon/auth-server";

type AuthHandlers = ReturnType<ReturnType<typeof createServerAuth>["handler"]>;

function handlers(): AuthHandlers {
  return createServerAuth().handler();
}

export async function GET(request: Request) {
  return handlers().GET(request);
}
export async function POST(request: Request) {
  return handlers().POST(request);
}
export async function PUT(request: Request) {
  return handlers().PUT(request);
}
export async function DELETE(request: Request) {
  return handlers().DELETE(request);
}
export async function PATCH(request: Request) {
  return handlers().PATCH(request);
}
