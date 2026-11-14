import type { ThemeId, WhereTab } from "../types";

export interface Demo {
  title: string;
  summary: string;
  theme: ThemeId;
  /** Preset name to investigate. */
  place: string;
  variable: string;
  whereTab: WhereTab;
  /** Text shown on the final tour step, about the “where is it changing?” section. */
  whereQuestion: string;
}

export const DEMOS: Demo[] = [
  {
    title: "Is the Arctic warming?",
    summary: "Air temperature in Svalbard, at 78° north latitude.",
    theme: "heat",
    place: "Svalbard",
    variable: "T2M",
    whereTab: "world",
    whereQuestion: "Is the Arctic changing at the same pace as the rest of the planet? Here the same calculation is repeated at several places around the world.",
  },
  {
    title: "Has the rain returned to the Sahel?",
    summary: "Precipitation on the southern edge of the Sahara, after the great droughts of the 1980s.",
    theme: "water",
    place: "Niamey",
    variable: "PRECTOTCORR",
    whereTab: "region",
    whereQuestion: "Is the change the same across the whole neighborhood? The map calculates the trend of each grid cell around the point.",
  },
  {
    title: "Has the air in Beijing changed?",
    summary: "Suspended particles (aerosols) over a megacity, since 2001.",
    theme: "air",
    place: "Beijing",
    variable: "AOD_55",
    whereTab: "world",
    whereQuestion: "And in other cities and regions? The same variable can go in opposite directions in different places.",
  },
];
