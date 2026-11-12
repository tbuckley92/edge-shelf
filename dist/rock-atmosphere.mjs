export const defaultAtmosphere=Object.freeze({fog:true,density:70,speed:30,colour:'#b9d6dc',background:'mountains'});
export function validateAtmosphere(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.fog!=='boolean'||!Number.isInteger(value.density)||value.density<0||value.density>100||!Number.isInteger(value.speed)||value.speed<0||value.speed>100||typeof value.colour!=='string'||!/^#[0-9a-f]{6}$/i.test(value.colour)||!['mountains','sky'].includes(value.background))throw Error('Choose valid fog and background settings.');
 return {fog:value.fog,density:value.density,speed:value.speed,colour:value.colour.toLowerCase(),background:value.background};
}
