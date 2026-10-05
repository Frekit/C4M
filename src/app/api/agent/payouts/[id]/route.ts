import { readAgentPayout } from "@/lib/agent/commands";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (!user) {
    return Response.json({ error: "Sin sesión" }, { status: 401 });
  }
  const { id } = await params;
  return readAgentPayout(id, user);
}
