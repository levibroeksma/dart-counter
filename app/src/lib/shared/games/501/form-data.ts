/**
 * Converts 501 settings form fields to validation input.
 */
export function parseFiveOhOneSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    if (key === "targetCount") {
      settings[key] = Number(value);
      continue;
    }

    if (key === "players") {
      try {
        settings[key] = JSON.parse(value);
      } catch {
        settings[key] = null;
      }
      continue;
    }

    settings[key] = value;
  }

  return settings;
}
