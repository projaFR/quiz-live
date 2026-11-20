/* Dessins de base du moteur : outils de dessin + personnages génériques. */
const S='stroke="#1b1b1b" stroke-width="3" stroke-linejoin="round"';
const eyes=(x,y,g=14,c='#1b1b1b')=>`<circle cx="${x-g}" cy="${y}" r="5.5" fill="${c}"/><circle cx="${x+g}" cy="${y}" r="5.5" fill="${c}"/><circle cx="${x-g+1.8}" cy="${y-2}" r="1.8" fill="#fff"/><circle cx="${x+g+1.8}" cy="${y-2}" r="1.8" fill="#fff"/>`;
const face=(x,y,m='smile',g=14)=>{
  let mo='';
  if(m==='smile')mo=`<path d="M${x-9} ${y+13} Q${x} ${y+23} ${x+9} ${y+13}" fill="none" ${S} stroke-linecap="round"/>`;
  if(m==='sad')mo=`<path d="M${x-8} ${y+20} Q${x} ${y+12} ${x+8} ${y+20}" fill="none" ${S} stroke-linecap="round"/>`;
  if(m==='o')mo=`<ellipse cx="${x}" cy="${y+17}" rx="5" ry="6" fill="#1b1b1b"/>`;
  if(m==='grin')mo=`<path d="M${x-11} ${y+12} H${x+11} Q${x+10} ${y+25} ${x} ${y+25} Q${x-10} ${y+25} ${x-11} ${y+12}Z" fill="#7a1f2e" ${S}/>`;
  const e=m==='cool'?`<path d="M${x-g-9} ${y-6} H${x+g+9} V${y+1} Q${x+g+8} ${y+8} ${x+g} ${y+8} Q${x+6} ${y+8} ${x+4} ${y} H${x-4} Q${x-6} ${y+8} ${x-g} ${y+8} Q${x-g-8} ${y+8} ${x-g-9} ${y+1}Z" fill="#1b1b1b"/>`+`<path d="M${x-8} ${y+14} Q${x+2} ${y+22} ${x+10} ${y+12}" fill="none" ${S} stroke-linecap="round"/>`:eyes(x,y,g);
  return e+`<circle cx="${x-g-6}" cy="${y+12}" r="5" fill="#ff7b9c" opacity=".55"/><circle cx="${x+g+6}" cy="${y+12}" r="5" fill="#ff7b9c" opacity=".55"/>`+mo;
};
const sh=(rx=58)=>`<ellipse cx="100" cy="178" rx="${rx}" ry="8" fill="#000" opacity=".16"/>`;
const svg=b=>`<svg viewBox="0 0 200 190" aria-hidden="true">${b}</svg>`;
const ART={
bulle:()=>svg(sh(56)+`<path d="M40 40 H160 Q172 40 172 52 V128 Q172 140 160 140 H96 L66 168 L72 140 H40 Q28 140 28 128 V52 Q28 40 40 40Z" fill="#fff" ${S}/><text x="150" y="78" font-family="Fredoka" font-weight="700" font-size="30" fill="#ff4f79">?</text>`+face(96,84,'smile',16)),
loupe:()=>svg(sh(50)+`<rect x="124" y="118" width="20" height="58" rx="8" fill="#7a5a2b" transform="rotate(-40 134 147)" ${S}/><circle cx="92" cy="88" r="56" fill="#cfeaff" ${S}/><circle cx="92" cy="88" r="44" fill="#eaf6ff"/><path d="M74 54 q-14 10 -14 26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`+face(92,80,'sad',13)),
podium:()=>svg(sh(80)+`<rect x="74" y="70" width="52" height="100" fill="#ffcf33" ${S}/><rect x="22" y="100" width="52" height="70" fill="#dfe6ea" ${S}/><rect x="126" y="122" width="52" height="48" fill="#e7b37a" ${S}/><text x="100" y="128" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="30" fill="#1b1b1b">1</text><text x="48" y="146" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="26" fill="#1b1b1b">2</text><text x="152" y="156" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="22" fill="#1b1b1b">3</text><circle cx="168" cy="160" r="18" fill="#5aa0ff" ${S}/>${eyes(168,156,6)}<path d="M162 168 Q168 163 174 168" fill="none" stroke="#1b1b1b" stroke-width="2.5"/>`),
trophee:()=>svg(sh(46)+`<rect x="70" y="150" width="60" height="22" rx="4" fill="#7a5a2b" ${S}/><rect x="92" y="122" width="16" height="30" fill="#ffcf33" ${S}/><path d="M56 30 H144 V70 Q144 122 100 124 Q56 122 56 70Z" fill="#ffcf33" ${S}/><path d="M56 44 Q28 44 32 70 Q36 92 60 92 M144 44 Q172 44 168 70 Q164 92 140 92" fill="none" ${S}/>`+face(100,64,'grin',14)),
eleve:(h='#6b3e1f',sk='#f2c8a0',t='#2b7de9')=>svg(sh(56)+`<path d="M52 176 Q52 128 100 128 Q148 128 148 176Z" fill="${t}" ${S}/><circle cx="100" cy="86" r="46" fill="${sk}" ${S}/><path d="M56 78 Q60 36 100 38 Q142 38 145 80 Q128 60 100 64 Q74 58 56 78Z" fill="${h}" ${S}/>`+face(100,88,'smile',15)),
heart:()=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28 C4 19 2 12 6 7 C10 3 15 5 16 9 C17 5 22 3 26 7 C30 12 28 19 16 28Z" fill="#ff4f79" stroke="#1b1b1b" stroke-width="2"/></svg>`,
broken:()=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 28 C4 19 2 12 6 7 C10 3 15 5 16 9 L13 15 L18 19 L15 28Z" fill="#9aa5ad" stroke="#1b1b1b" stroke-width="2"/><path d="M17 9 C18 5 22 3 26 7 C30 12 28 19 18 27 L20 19 L15 15Z" fill="#9aa5ad" stroke="#1b1b1b" stroke-width="2"/></svg>`
};
const bin=c=>`<svg viewBox="0 0 60 70" aria-hidden="true"><rect x="24" y="4" width="12" height="7" rx="2" fill="${c}" stroke="#1b1b1b" stroke-width="2.5"/><rect x="5" y="10" width="50" height="10" rx="3" fill="${c}" stroke="#1b1b1b" stroke-width="2.5"/><path d="M10 20 H50 L46 66 H14Z" fill="${c}" stroke="#1b1b1b" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 30 V56 M30 30 V56 M38 30 V56" stroke="#1b1b1b" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/></svg>`;
const flagSvg=c=>`<svg viewBox="0 0 34 40" aria-hidden="true"><rect x="4" y="2" width="4" height="36" rx="2" fill="#1b1b1b"/><path d="M8 4 H30 L24 12 L30 20 H8Z" fill="${c}" stroke="#1b1b1b" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
