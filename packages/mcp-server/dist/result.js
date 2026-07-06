/** JSON tool result with bigint-safe serialization. */
export function jsonResult(data) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
            },
        ],
    };
}
export function errorResult(message) {
    return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
    };
}
//# sourceMappingURL=result.js.map