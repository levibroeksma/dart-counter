import { describe, it, expect } from "vitest";
import { parseFiveOhOneSettingsFormData } from "@lib/shared/games/501/form-data";

describe("parseFiveOhOneSettingsFormData", () => {
  it("parses match format fields and players JSON", () => {
    const formData = new FormData();
    formData.set("matchMode", "best-of");
    formData.set("targetCount", "3");
    formData.set("unit", "legs");
    formData.set(
      "players",
      JSON.stringify([{ id: "user-1", type: "user", name: "Levi" }]),
    );

    expect(parseFiveOhOneSettingsFormData(formData)).toEqual({
      matchMode: "best-of",
      targetCount: 3,
      unit: "legs",
      players: [{ id: "user-1", type: "user", name: "Levi" }],
    });
  });
});
