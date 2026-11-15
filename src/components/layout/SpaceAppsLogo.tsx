import blackLogo from "../../assets/space-apps-black.png";
import whiteLogo from "../../assets/space-apps-white.png";
import "./SpaceAppsLogo.css";

/**
 * NASA Space Apps Challenge logo; the variant matching the colour scheme is picked in CSS.
 * `markOnly` crops it to the symbol on the left, without the wordmark.
 */
export function SpaceAppsLogo({ className = "", markOnly = false }: { className?: string; markOnly?: boolean }) {
  const classes = ["space-apps-logo", markOnly && "mark-only", className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <img className="on-light" src={blackLogo} alt="NASA International Space Apps Challenge" />
      <img className="on-dark" src={whiteLogo} alt="NASA International Space Apps Challenge" />
    </span>
  );
}
