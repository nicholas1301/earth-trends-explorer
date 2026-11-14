import type { ReactNode } from "react";
import { FIRST_YEAR, LAST_YEAR, PRESETS, VARIABLES, VARIABLE_BY_ID, themeById } from "../../config/catalog";
import type { Demo } from "../../config/demos";
import { formatNumber, formatPValue } from "../../lib/format";
import { placeFromPreset } from "../../lib/places";
import { LEVEL_LABELS, type TrendResult } from "../../lib/trend";
import type { Actions } from "../../state/InvestigationContext";
import type { Step } from "../../types";

export interface TourStep {
  /** Screen the step happens on. */
  step: Step;
  /** id of the element to spotlight. */
  target: string;
  /** Side effect executed when the step is reached going forward. */
  run?: () => unknown;
  /** Rendered after `run` finishes, with the latest analysis result. */
  text: (result: TrendResult | null) => ReactNode;
}

export function buildTourSteps(demo: Demo, actions: Actions): TourStep[] {
  const v = VARIABLE_BY_ID[demo.variable];
  const theme = themeById(demo.theme);
  const preset = PRESETS.find((p) => p.name === demo.place)!;

  return [
    {
      step: "theme",
      target: "q-theme",
      run: () => actions.setTheme(demo.theme),
      text: () => <>Every detective starts with a question. Ours: <b>{demo.title}</b> First we choose the topic — here, “{theme.name}”.</>,
    },
    {
      step: "place",
      target: "q-place",
      run: () => actions.setPlace(placeFromPreset(preset)),
      text: () => (
        <>Then, the place: <b>{preset.name}</b> ({preset.region}), an example of {preset.tag}. You can also click any point on the globe.</>
      ),
    },
    {
      step: "clues",
      target: "sec-clues",
      run: async () => {
        actions.setFilters({ y0: FIRST_YEAR, y1: LAST_YEAR, season: "year" });
        actions.setView("annual");
        await actions.investigate({ place: placeFromPreset(preset), variable: demo.variable });
      },
      text: () => (
        <>
          The tool downloaded the monthly NASA data since {FIRST_YEAR} and tested {VARIABLES.length} variables at once. Each row is a clue:
          the thumbnail shows the series, and the label says whether it is rising or falling and how strong the evidence is.
        </>
      ),
    },
    {
      step: "verdict",
      target: "sec-verdict",
      text: (r) =>
        r?.ok ? (
          <>
            We chose <b>{v.name.toLowerCase()}</b>. The verdict:{" "}
            {r.direction === 0 ? (
              "no measurable change"
            ) : (
              <>
                {r.direction > 0 ? "an increase" : "a decrease"} of {formatNumber(Math.abs(r.mk.sen * 10), v.digits)} {v.unit} per decade, with{" "}
                <b>{LEVEL_LABELS[r.level]}</b> evidence ({formatPValue(r.mk.p)})
              </>
            )}
            . Two independent tests answer whether this could be coincidence.
          </>
        ) : (
          "The verdict appears here, with two independent statistical tests."
        ),
    },
    {
      step: "verdict",
      target: "chart",
      text: () => (
        <>
          Here is the evidence. Each dot is the mean of one year. The red line is the trend; the shaded band around it shows the
          uncertainty. If a flat line fits inside the band, the trend may be just chance.
        </>
      ),
    },
    {
      step: "verdict",
      target: "mbars",
      text: () => "The change does not have to be the same all year. Here the trend is calculated month by month: filled bars are significant, hollow bars are not.",
    },
    {
      step: "compare",
      target: "sec-where",
      run: () => {
        actions.setWhereTab(demo.whereTab);
        actions.request(demo.whereTab);
      },
      text: () => <>{demo.whereQuestion} Now it’s up to you: change the topic, the place or the period and follow the clues!</>,
    },
  ];
}
