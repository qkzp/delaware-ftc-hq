export default function RobotIllustration() {
  return (
    <svg
      viewBox="0 0 420 260"
      className="robot-illustration"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
          patternTransform="matrix(1 .5 -1 .5 220 20)"
        >
          <path
            d="M28 0H0V28"
            fill="none"
            stroke="#72815c"
            strokeOpacity=".18"
          />
        </pattern>
        <linearGradient id="chassis" x2="0" y2="1">
          <stop stopColor="#48705a" />
          <stop offset="1" stopColor="#234b3b" />
        </linearGradient>
      </defs>
      <ellipse
        cx="226"
        cy="208"
        rx="155"
        ry="30"
        fill="#70804c"
        opacity=".09"
      />
      <path d="M10 190L205 80 413 184 216 282Z" fill="url(#grid)" />
      <g fill="none" stroke="#6d8050" strokeWidth="1" opacity=".6">
        <path d="M72 78v-14h43M335 195h34v-35" />
        <path d="M319 46v22m-11-11h22" />
        <circle cx="73" cy="184" r="5" />
        <path d="M109 36l3-7 3 7 7 3-7 3-3 7-3-7-7-3z" />
      </g>
      <g transform="translate(55 5)">
        <g fill="#293d32" stroke="#1b3025" strokeWidth="3">
          <path d="M93 150c-15-8-26 1-26 18s11 32 26 37c14 5 23-3 23-18s-9-29-23-37Z" />
          <path d="M243 145c-15-8-26 1-26 18s11 32 26 37c14 5 23-3 23-18s-9-29-23-37Z" />
          <path d="M176 194c-15-8-26 1-26 18s11 32 26 37c14 5 23-3 23-18s-9-29-23-37Z" />
        </g>
        <g fill="#a3b494" stroke="#52684b" strokeWidth="2">
          <ellipse
            cx="91"
            cy="178"
            rx="9"
            ry="15"
            transform="rotate(-25 91 178)"
          />
          <ellipse
            cx="242"
            cy="174"
            rx="9"
            ry="15"
            transform="rotate(-25 242 174)"
          />
          <ellipse
            cx="175"
            cy="221"
            rx="9"
            ry="15"
            transform="rotate(-25 175 221)"
          />
        </g>
        <path
          d="M85 141l83-45 115 64-85 47z"
          fill="#65816a"
          stroke="#254d3e"
          strokeWidth="2"
        />
        <path
          d="M85 141v32l113 64v-30z"
          fill="url(#chassis)"
          stroke="#254d3e"
          strokeWidth="2"
        />
        <path
          d="M198 207l85-47v31l-85 46z"
          fill="#274d3b"
          stroke="#254d3e"
          strokeWidth="2"
        />
        <path
          d="M95 146l102 57 73-40-102-57z"
          fill="#96b179"
          stroke="#cad8ad"
          strokeWidth="2"
        />
        <g stroke="#304d37" strokeWidth="5" fill="none" strokeLinejoin="round">
          <path d="M115 149V80l69-37 65 37v82M115 80l65 38 69-38M180 118v67M116 97l63 37 68-38" />
          <path d="M131 72l64 37M151 61l63 37" strokeWidth="2" />
        </g>
        <path
          d="M123 83l56 32 61-34-56-32z"
          fill="#dfe9c0"
          stroke="#36563d"
          strokeWidth="2"
        />
        <path d="M135 84l47 27 45-25-47-27z" fill="#eff2d5" />
        <path
          d="M135 64V38l43-24 43 25v28l-43 25z"
          fill="#e8edd2"
          stroke="#34533d"
          strokeWidth="2"
        />
        <path
          d="M135 38l43 25 43-24M178 63v29"
          fill="none"
          stroke="#34533d"
          strokeWidth="2"
        />
        <g fill="#355941">
          <path d="M145 48l9 5v10l-9-5zM161 57l9 5v10l-9-5z" />
        </g>
        <path
          d="M151 75l17 9"
          stroke="#355941"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M178 14V3" stroke="#34533d" strokeWidth="2" />
        <circle
          cx="178"
          cy="3"
          r="5"
          fill="#ec9a66"
          stroke="#34533d"
          strokeWidth="2"
        />
        <path
          d="M194 125l33-18v31l-33 18z"
          fill="#e9a477"
          stroke="#536744"
          strokeWidth="2"
        />
        <path d="M201 127l18-10v15l-18 10z" fill="#f5d0a3" />
        <path d="M127 161l29 17v17l-29-17z" fill="#dae8af" />
        <path d="M133 169l17 10" stroke="#54724b" strokeWidth="2" />
        <g fill="#d6e2b6">
          <circle cx="103" cy="164" r="2" />
          <circle cx="185" cy="211" r="2" />
          <circle cx="211" cy="212" r="2" />
          <circle cx="269" cy="180" r="2" />
        </g>
      </g>
      <g transform="translate(295 100) rotate(-7)">
        <rect width="98" height="31" rx="8" fill="#f8faed" stroke="#bccf97" />
        <circle cx="16" cy="15.5" r="7" fill="#41664a" />
        <path
          d="M12 15l3 3 5-5"
          stroke="#f8faed"
          fill="none"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <text
          x="30"
          y="19"
          fontFamily="system-ui,sans-serif"
          fontSize="10"
          fontWeight="600"
          fill="#39523c"
        >
          Built together.
        </text>
      </g>
    </svg>
  );
}
