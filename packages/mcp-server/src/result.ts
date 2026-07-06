/** JSON tool result with bigint-safe serialization. */
export function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          data,
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          2,
        ),
      },
    ],
  };
}

export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
