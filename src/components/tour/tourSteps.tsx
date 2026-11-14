import type { ReactNode } from "react";
import { FIRST_YEAR, LAST_YEAR, PRESETS, VARIABLES, VARIABLE_BY_ID, themeById } from "../../config/catalog";
import type { Demo } from "../../config/demos";
import { formatNumber, formatPValue } from "../../lib/format";
import { placeFromPreset } from "../../lib/places";
import { LEVEL_LABELS, type TrendResult } from "../../lib/trend";
import type { Actions } from "../../state/InvestigationContext";

export interface TourStep {
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
  const question = demo.title.replace(/^\S+\s/, "");

  return [
    {
      target: "q-theme",
      run: () => actions.setTheme(demo.theme),
      text: () => <>Every detective starts with a question. Ours: <b>{question}</b> First we choose the theme — here, “{theme.name}”.</>,
    },
    {
      target: "q-place",
      run: () => actions.setPlace(placeFromPreset(preset)),
      text: () => (
        <>Then, the place: <b>{preset.name}</b> ({preset.region}), an example of {preset.tag}. You can also click any point on the map.</>
      ),
    },
    {
      target: "sec-clues",
      run: async () => {
        actions.setFilters({ y0: FIRST_YEAR, y1: LAST_YEAR, season: "year" });
        actions.setView("annual");
        await actions.investigate({ place: placeFromPreset(preset), variable: demo.variable });
      },
      text: () => (
        <>
          The tool downloaded the monthly NASA data since {FIRST_YEAR} and tested {VARIABLES.length} variables at once. Each row is a clue:
          the thumbnail shows the series, and the dots show the strength of the evidence.
        </>
      ),
    },
    {
      target: "chart",
      text: () => (
        <>
          We chose <b>{v.name.toLowerCase()}</b>. Each blue dot is the mean of one year. The orange line is the trend; the band around it shows
          the uncertainty. If the band allows a horizontal line, the trend may be just chance.
        </>
      ),
    },
    {
      target: "sec-verdict",
      text: (r) =>
        r?.ok ? (
          <>
            The verdict:{" "}
            {r.direction === 0 ? (
              "no measurable change"
            ) : (
              <>
                {r.direction > 0 ? "an increase" : "a decrease"} of {formatNumber(Math.abs(r.mk.sen * 10), v.digits)} {v.unit} per decade, with{" "}
                <b>{LEVEL_LABELS[r.level]}</b> evidence ({formatPValue(r.mk.p)})
              </>
            )}
            . Two independent tests — Mann-Kendall and the t-test — answer whether this could be coincidence.
          </>
        ) : (
          "The verdict appears here, with two independent statistical tests."
        ),
    },
    {
      target: "mbars",
      text: () => "The change does not have to be the same all year. Here the trend is calculated month by month: filled bars are significant, hollow bars are not.",
    },
    {
      target: "sec-where",
      run: () => {
        actions.setWhereTab(demo.whereTab);
        actions.request(demo.whereTab);
      },
      text: () => <>{demo.whereQuestion} Now it’s up to you: change the theme, the place or the period and follow the clues!</>,
    },
  ];
}
