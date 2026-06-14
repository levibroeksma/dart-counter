export const MessageCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MISSING_FIELDS: "MISSING_FIELDS",
  SERVER_CONFIG: "SERVER_CONFIG",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_DISPLAY_NAME: "INVALID_DISPLAY_NAME",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVER_ERROR: "SERVER_ERROR",
  UNKNOWN_GAME: "UNKNOWN_GAME",
  UNAVAILABLE_GAME: "UNAVAILABLE_GAME",
  INVALID_GAME_SETTINGS: "INVALID_GAME_SETTINGS",
  INVALID_ROUND: "INVALID_ROUND",
} as const;

export type MessageCode = (typeof MessageCode)[keyof typeof MessageCode];

export const errorMessages: Record<MessageCode, string> = {
  [MessageCode.INVALID_CREDENTIALS]: "Invalid username or password",
  [MessageCode.MISSING_FIELDS]: "Username and password are required",
  [MessageCode.SERVER_CONFIG]: "Server configuration error",
  [MessageCode.NETWORK_ERROR]: "Unable to connect. Please try again.",
  [MessageCode.INVALID_DISPLAY_NAME]: "Display name must be 2–20 characters",
  [MessageCode.UNAUTHORIZED]: "You must be logged in",
  [MessageCode.SERVER_ERROR]: "Something went wrong. Please try again.",
  [MessageCode.UNKNOWN_GAME]: "That game does not exist.",
  [MessageCode.UNAVAILABLE_GAME]: "That game is not available yet.",
  [MessageCode.INVALID_GAME_SETTINGS]: "Invalid game settings.",
  [MessageCode.INVALID_ROUND]: "Invalid round data.",
};
