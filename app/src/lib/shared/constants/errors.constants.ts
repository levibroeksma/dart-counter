export const MessageCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MISSING_FIELDS: "MISSING_FIELDS",
  SERVER_CONFIG: "SERVER_CONFIG",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type MessageCode = (typeof MessageCode)[keyof typeof MessageCode];

export const errorMessages: Record<MessageCode, string> = {
  [MessageCode.INVALID_CREDENTIALS]: "Invalid username or password",
  [MessageCode.MISSING_FIELDS]: "Username and password are required",
  [MessageCode.SERVER_CONFIG]: "Server configuration error",
  [MessageCode.NETWORK_ERROR]: "Unable to connect. Please try again.",
};
