/**
 * Converts singles-training settings form fields to validation input.
 */
export function parseSinglesTrainingSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    settings[key] = value;
  }

  return settings;
}
