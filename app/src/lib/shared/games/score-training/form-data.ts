/**
 * Converts score-training settings form fields to validation input.
 */
export function parseScoreTrainingSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    if (key === "roundCount") {
      settings[key] = Number(value);
      continue;
    }

    if (key === "playtimeMinutes") {
      settings.playtimeSeconds = Number(value) * 60;
      continue;
    }

    settings[key] = value;
  }

  return settings;
}
