// Artwork calibration: 584 pixels of mantel represent 200 cm at the back wall.
export const MANTEL_PIXELS=584;
export function pieceSize(product,asset,mantelCm=200,perspective=1){
 const height=Number(product.h);if(!Number.isFinite(height)||height<=0)return null;
 const pixelsPerCm=MANTEL_PIXELS/mantelCm*perspective;
 const h=height*pixelsPerCm;
 return {height:h,width:h*asset.width/asset.height,pixelsPerCm};
}
