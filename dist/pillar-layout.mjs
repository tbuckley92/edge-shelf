export const pillarLabels={egyptian:'Egyptian',aztec:'Aztec',ice:'Ice',lava:'Lava',jungle:'Jungle',greek:'Greek',tree:'Tree Stump',gothic:'Gothic',crystal:'Crystal',coral:'Coral'};
export const pillarStyles=Object.keys(pillarLabels);
export function pillarProjection(distance,width){
 // Upcoming pieces queue on the left, grow into focus, then leave horizontally right.
 if(distance>=0){
  const focus=Math.exp(-1.3*distance*distance),depth=Math.exp(-.7*distance*distance);
  return {x:-width*.46*(1-Math.exp(-1.4*distance)),y:-14*Math.min(distance,4)**2,scale:.28+.72*focus,opacity:Math.max(0,1-distance/4)*(.3+.7*depth),depth};
 }
 const exit=-distance;
 return {x:width*.72*exit,y:0,scale:1,opacity:Math.max(0,1-exit/2),depth:Math.max(0,1-exit/2)};
}
