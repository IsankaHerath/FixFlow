import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function check(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 422 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2034"].includes(error.code)
  )
    return Response.json(
      {
        error: "This record changed or already exists. Refresh and try again.",
      },
      { status: 409 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
