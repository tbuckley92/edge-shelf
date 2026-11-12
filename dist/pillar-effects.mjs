export const weatherTypes=['none','rain','snow','sleet','storm','aurora','sandstorm','plasma'];
export const defaultPillarEffects=Object.freeze({fog:true,fogSpeed:30,fogColour:'#b6b6be',fogDensity:40,weather:'none',weatherSpeed:40,weatherColour:'#c5d9ec',weatherDensity:45});
export function validatePillarEffects(value){
 if(value===undefined)return {...defaultPillarEffects};
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.fog!=='boolean'||!weatherTypes.includes(value.weather))throw Error('Choose valid pillar effects.');
 for(const key of ['fogSpeed','fogDensity','weatherSpeed','weatherDensity'])if(!Number.isInteger(value[key])||value[key]<0||value[key]>100)throw Error('Effect speed and density must be between 0 and 100.');
 for(const key of ['fogColour','weatherColour'])if(typeof value[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Choose a valid effect colour.');
 return Object.fromEntries(Object.keys(defaultPillarEffects).map(key=>[key,key.endsWith('Colour')?value[key].toLowerCase():value[key]]));
}
export function paintPillarEffects(node,value){
 const e={...defaultPillarEffects,...value};
 node.querySelector('.pillar-effects')?.remove();
 const layer=document.createElement('span');layer.className='pillar-effects';layer.setAttribute('aria-hidden','true');
 layer.style.setProperty('--pf-colour',e.fogColour);layer.style.setProperty('--pf-density',e.fog?e.fogDensity/100:0);layer.style.setProperty('--pf-duration',(60-e.fogSpeed*.5)+'s');
 layer.style.setProperty('--pw-colour',e.weatherColour);layer.style.setProperty('--pw-density',e.weatherDensity/100);layer.style.setProperty('--pw-rate',String(2.5-e.weatherSpeed*.022));
 layer.classList.toggle('fog-static',e.fogSpeed===0);layer.classList.toggle('weather-static',e.weatherSpeed===0);
 const fog=document.createElement('span');fog.className='pillar-low-fog';layer.append(fog);
 const weather=document.createElement('span');weather.className='pillar-weather weather-'+e.weather;
 if(['rain','snow','sleet','storm','sandstorm'].includes(e.weather))for(let i=0;i<32;i++){const p=document.createElement('i');p.style.setProperty('--x',((i*37)%101)+'%');p.style.setProperty('--delay',String(-(i*1.37)%9)+'s');p.style.setProperty('--fall',(.7+(i%7)*.17)+'s');p.style.setProperty('--size',(2+i%4)+'px');weather.append(p)}
 layer.append(weather);node.append(layer);
}
