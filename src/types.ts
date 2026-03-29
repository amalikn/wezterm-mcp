export type ContentItem = {
  type: "text";
  text: string;
};

export type McpResponse = {
  content: ContentItem[];
  isError?: boolean;
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function textResponse(
  text: string,
  options?: { isError?: boolean }
): McpResponse {
  return {
    ...(options?.isError ? { isError: true } : {}),
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}
