import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import Settings501 from "@components/games/501/SettingsForm.astro";
import Play501 from "@components/games/501/Play.astro";
import SettingsTenUp from "@components/games/ten-up-one-down/SettingsForm.astro";
import PlayTenUp from "@components/games/ten-up-one-down/Play.astro";
import Settings121 from "@components/games/121/SettingsForm.astro";
import Play121 from "@components/games/121/Play.astro";
import SettingsScoreTraining from "@components/games/score-training/SettingsForm.astro";
import PlayScoreTraining from "@components/games/score-training/Play.astro";
import SettingsSinglesTraining from "@components/games/singles-training/SettingsForm.astro";
import PlaySinglesTraining from "@components/games/singles-training/Play.astro";

type GameComponentPair = {
  settingsForm: AstroComponentFactory;
  play: AstroComponentFactory;
};

const REGISTRY: Record<string, GameComponentPair> = {
  "501": { settingsForm: Settings501, play: Play501 },
  "ten-up-one-down": { settingsForm: SettingsTenUp, play: PlayTenUp },
  "121": { settingsForm: Settings121, play: Play121 },
  "score-training": {
    settingsForm: SettingsScoreTraining,
    play: PlayScoreTraining,
  },
  "singles-training": {
    settingsForm: SettingsSinglesTraining,
    play: PlaySinglesTraining,
  },
};

export function hasGameComponents(slug: string): boolean {
  return slug in REGISTRY;
}

export function getSettingsFormComponent(
  slug: string
): AstroComponentFactory | undefined {
  return REGISTRY[slug]?.settingsForm;
}

export function getPlayComponent(
  slug: string
): AstroComponentFactory | undefined {
  return REGISTRY[slug]?.play;
}
