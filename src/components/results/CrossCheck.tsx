import { BOX_HALF_SIZE, GIOVANNI_MATCHES, giovanniUrl } from "../../config/externalSources";
import type { Filters, Place, Variable } from "../../types";
import "./CrossCheck.css";

interface Props {
  variable: Variable;
  place: Place;
  filters: Filters;
  /** Opens the screen where the downloaded file can be analysed. */
  onImport(): void;
}

/** Links that open NASA Giovanni pre-filled for this place and period, to confirm the trend with an independent record. */
export function CrossCheck({ variable: v, place, filters, onImport }: Props) {
  const matches = GIOVANNI_MATCHES[v.id] ?? [];
  if (!matches.length) return null;

  return (
    <div className="analysis-block crosscheck">
      <h3>Confirm it with another NASA record</h3>
      <p className="muted" style={{ margin: 0 }}>
        A trend is more convincing when an independent instrument or model sees it too. Each link opens NASA Giovanni already set up:
        a {BOX_HALF_SIZE * 2}° × {BOX_HALF_SIZE * 2}° box around {place.name}, the years {filters.y0}–{filters.y1} and the variable
        ticked. Press <i>Plot Data</i>, download the CSV and{" "}
        <button type="button" className="link" onClick={onImport}>analyze it here</button> with the same tests.
      </p>
      <ul>
        {matches.map((m) => (
          <li key={m.keyword}>
            <a href={giovanniUrl(place.lat, place.lon, Math.max(filters.y0, m.since), filters.y1, m)} target="_blank" rel="noreferrer">
              {m.label} ↗
            </a>
            <span className="muted"> · {m.kind} · since {m.since}{m.since > filters.y0 ? " (shorter record)" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
