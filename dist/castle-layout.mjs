// Geometry in the 1024 × 1536 background; physical dimensions scale with mantel width.
export const surfaces=[
 ['Upper left alcove',277,465,158,35,55],['Upper centre alcove',491,465,158,35,55],['Upper right alcove',702,465,158,35,55],
 ['Lower left shelf',277,677,158,35,62],['Lower centre shelf',491,677,158,35,62],['Lower right shelf',702,677,158,35,62],
 ['Fireplace mantel',469,941,470,42,70],['Window cabinet',129,1063,182,42,80],['Right console',811,1055,170,38,80]
];
export function dimensions(s,mantel=200){const scale=mantel/200;return {width:s[3]/493*mantel,depth:s[4]*scale,height:s[5]*scale,gap:3*scale,margin:2*scale,px:493/mantel};}
export function fit(items,product,s,mantel=200){const d=dimensions(s,mantel);if(![product?.w,product?.h,product?.d].every(v=>Number(v)>0))return 'Dimensions unavailable';if(product.d>d.depth)return 'Too deep';if(product.h>d.height)return 'Too tall';const used=items.reduce((v,p)=>v+Number(p.w),0)+items.length*d.gap;if(used+Number(product.w)+2*d.margin>d.width+.001)return 'Not enough width';return '';}
export function positions(items,s,mantel=200){const d=dimensions(s,mantel);let x=-((items.reduce((v,p)=>v+Number(p.w||0),0)+Math.max(0,items.length-1)*d.gap)*d.px)/2;return items.map(p=>{const w=Number(p.w||0)*d.px;const result={x:s[1]+x+w/2,y:s[2],height:Number(p.h||0)*d.px};x+=w+d.gap*d.px;return result;});}
export function migrate(old){return {...old,pieces:[...old.pieces.slice(0,6).map(x=>x?[x]:[]),old.pieces.slice(6,8).filter(Boolean),...old.pieces.slice(8,10).map(x=>x?[x]:[])]};}
