// Dessins des états vides (prototype V3) : un objet posé sur sa ligne de sol.
const svgProps = {
  className: "es-art", viewBox: "0 0 200 130", "aria-hidden": true, fill: "none", stroke: "#34503B",
  strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round",
} as const;

const Ground = () => <path d="M28 118h6M42 118h8M58 118h114" stroke="#34503B" strokeWidth="3" strokeLinecap="round" />;

/** Un frigo dans le viseur : pas encore de scan. */
export function ArtFridge() {
  return (
    <svg {...svgProps}>
      <g className="es-scan" stroke="#527659" strokeWidth="4"><path d="M54 26v-8a8 8 0 0 1 8-8h8M130 10h8a8 8 0 0 1 8 8v8M146 88v8a8 8 0 0 1-8 8h-8" /><path d="M70 104h-8a8 8 0 0 1-8-8v-8" /></g>
      <rect x="72" y="24" width="56" height="94" rx="11" fill="#FBF7EF" />
      <path d="M72 54h56" />
      <rect x="113" y="33" width="5" height="13" rx="2.5" fill="#DCE5D5" /><rect x="113" y="62" width="5" height="20" rx="2.5" fill="#DCE5D5" />
      <path className="es-spark" d="M156 44l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#E0A44A" stroke="none" />
      <circle cx="44" cy="62" r="3.5" fill="#E0A44A" stroke="none" />
      <Ground />
    </svg>
  );
}

/** Une boîte à recettes : pas encore de favori. */
export function ArtRecipeBox() {
  return (
    <svg {...svgProps}>
      <g className="es-bob">
        <rect x="70" y="30" width="62" height="44" rx="6" fill="#DCE5D5" transform="rotate(7 101 52)" />
        <rect x="64" y="26" width="62" height="44" rx="6" fill="#FBF7EF" transform="rotate(-6 95 48)" />
        <path d="M77 38h26M77 47h18" stroke="#B9C8B2" transform="rotate(-6 95 48)" />
      </g>
      <rect x="52" y="62" width="96" height="54" rx="9" fill="#E0A44A" />
      <path d="M52 76h96" strokeWidth="2.5" />
      <rect x="84" y="84" width="32" height="20" rx="5" fill="#FBF7EF" />
      <path d="M100 99c-5-3.4-7.5-5.6-7.5-8.3a3.6 3.6 0 0 1 7.5-1.2 3.6 3.6 0 0 1 7.5 1.2c0 2.7-2.5 4.9-7.5 8.3z" stroke="#527659" strokeWidth="2.2" />
      <circle cx="64" cy="117" r="3.5" fill="#34503B" /><circle cx="136" cy="117" r="3.5" fill="#34503B" />
      <Ground />
    </svg>
  );
}

/** Un sac de courses : liste vide. */
export function ArtBag() {
  return (
    <svg {...svgProps}>
      <path d="M82 50c0-22 36-22 36 0" stroke="#527659" strokeWidth="5" />
      <path d="M60 50h80l-6 66H66z" fill="#FBF7EF" />
      <path d="M60 50h80l-1.2 13H61.2z" fill="#DCE5D5" />
      <path d="M86 84c4 4 24 4 28 0" stroke="#B9C8B2" />
      <g className="es-spark"><circle cx="136" cy="92" r="13" fill="#E0A44A" /><path d="M130 92.5l4 4 8-8.5" stroke="#fff" strokeWidth="3" /></g>
      <Ground />
    </svg>
  );
}

/** Une cloche : rien de nouveau dans les notifications. */
export function ArtBell() {
  return (
    <svg {...svgProps}>
      <path d="M72 86c5-5 8-12 8-28a20 20 0 0 1 40 0c0 16 3 23 8 28z" fill="#FBF7EF" />
      <path d="M66 90h68" /><path d="M92 100a8 8 0 0 0 16 0" /><path d="M100 30v-6" />
      <path d="M88 52c1-5 4-8 8-9" stroke="#9FCCA4" strokeWidth="3.5" />
      <path className="es-spark" d="M152 40l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#E0A44A" stroke="none" />
      <circle cx="46" cy="58" r="3.5" fill="#E0A44A" stroke="none" />
      <Ground />
    </svg>
  );
}
