import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthzError } from "@/services/authz";

export function jsonError(status: number, message: string, issues?: unknown) {
  return NextResponse.json(
    issues === undefined ? { error: message } : { error: message, issues },
    { status },
  );
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new SyntaxError("Invalid JSON body");
  }
  return schema.parse(body);
}

export function withErrorMapping(
  handler: (req: Request) => Promise<NextResponse>,
): (req: Request) => Promise<NextResponse> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AuthzError) return jsonError(err.status, err.message);
      if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
      if (err instanceof SyntaxError) return jsonError(400, err.message);
      if (
        err instanceof Error &&
        /cannot publish|no version|no content block|permutation/i.test(err.message)
      ) {
        return jsonError(422, err.message);
      }
      console.error(err);
      return jsonError(500, "Internal error");
    }
  };
}
