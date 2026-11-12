export const pillarLabels={egyptian:'Egyptian',aztec:'Aztec',ice:'Ice',lava:'Lava',jungle:'Jungle',greek:'Greek',tree:'Tree Stump',gothic:'Gothic',crystal:'Crystal',coral:'Coral'};
export const pillarStyles=Object.keys(pillarLabels);
export function pillarProjection(distance,width){
 // A finite front arc: no modulo and no visible rear seam or wrapping.
 const angle=Math.max(-1.48,Math.min(1.48,distance*.58)),depth=Math.cos(angle);
 return {x:Math.sin(angle)*width*.53,y:-(1-depth)*110,scale:.48+.52*depth,opacity:Math.max(0,1-Math.abs(distance)/4)*(.35+.65*depth),depth};
}
