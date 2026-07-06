/** JSON tool result with bigint-safe serialization. */
export declare function jsonResult(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function errorResult(message: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
