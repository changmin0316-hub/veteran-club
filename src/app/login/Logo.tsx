// 새로 디자인한 VETERAN CLUB 로고 (원본 복제 아님).
// HTML 워드마크 + SVG 스워시/별 조합으로 안정적으로 렌더링.
export default function Logo() {
  return (
    <div
      style={{
        position: "relative",
        width: "min(360px, 82vw)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {/* 스워시 + 별 */}
      <svg
        viewBox="0 0 360 60"
        width="100%"
        height="60"
        style={{ display: "block" }}
        aria-hidden
      >
        <style>{`
          .vc-swoosh {
            stroke: var(--vc-yellow, #ffb600);
            stroke-width: 7;
            fill: none;
            stroke-linecap: round;
            stroke-dasharray: 460;
            stroke-dashoffset: 460;
            animation: vcDash 1.3s ease forwards;
          }
          .vc-star {
            fill: var(--vc-yellow, #ffb600);
            opacity: 0;
            transform-origin: 338px 16px;
            animation: vcFade .3s ease 1.1s forwards, vcSpin 6s linear 1.4s infinite;
          }
          @keyframes vcDash { to { stroke-dashoffset: 0; } }
          @keyframes vcFade { to { opacity: 1; } }
          @keyframes vcSpin { to { transform: rotate(360deg); } }
        `}</style>
        <path className="vc-swoosh" d="M8 52 L150 52 L344 18" />
        <polygon
          className="vc-star"
          points="338,4 342,14 353,14 344,21 347,32 338,25 329,32 332,21 323,14 334,14"
        />
      </svg>

      {/* 워드마크 */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          lineHeight: 1,
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-1px",
          marginTop: "-6px",
          fontFamily: "Arial, 'Helvetica Neue', sans-serif",
        }}
      >
        <span style={{ color: "var(--vc-yellow, #ffb600)", fontSize: "64px" }}>
          V
        </span>
        <span style={{ color: "#fff", fontSize: "50px" }}>ETERAN</span>
      </div>
    </div>
  );
}
