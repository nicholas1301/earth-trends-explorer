import blackLogo from "../../assets/space-apps-black.png";
import whiteLogo from "../../assets/space-apps-white.png";
import "./SpaceAppsLogo.css";

/** NASA Space Apps Challenge logo; the variant matching the colour scheme is picked in CSS. */
export function SpaceAppsLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`space-apps-logo ${className}`}>
      <img className="on-light" src={blackLogo} alt="NASA International Space Apps Challenge" />
      <img className="on-dark" src={whiteLogo} alt="NASA International Space Apps Challenge" />
    </span>
  );
}
