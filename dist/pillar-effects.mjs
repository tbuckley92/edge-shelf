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
 node.querySelectorAll('.pillar-effects').forEach(n=>n.remove());
 function element(cls){const n=document.createElement('span');n.className=cls;return n}
 function layer(cls){const n=element('pillar-effects '+cls);n.setAttribute('aria-hidden','true');
 n.style.setProperty('--pf-colour',e.fogColour);n.style.setProperty('--pf-density',e.fog?e.fogDensity/100:0);n.style.setProperty('--pf-duration',(60-e.fogSpeed*.5)+'s');
 n.style.setProperty('--pw-colour',e.weatherColour);n.style.setProperty('--pw-density',e.weatherDensity/100);n.style.setProperty('--pw-rate',String(2.5-e.weatherSpeed*.022));
 n.classList.toggle('fog-static',e.fogSpeed===0);n.classList.toggle('weather-static',e.weatherSpeed===0);node.append(n);return n}
 const back=layer('effects-behind'),front=layer('effects-front');front.append(element('pillar-low-fog'));
 const weather=element('pillar-weather weather-'+e.weather);
 if(['aurora','plasma'].includes(e.weather)){back.append(weather);return}
 if(e.weather==='storm'){
  const sky=element('storm-sky');sky.append(element('storm-cloud cloud-one'),element('storm-cloud cloud-two'),element('storm-cloud cloud-three'),element('storm-flash'),element('storm-bolt'));back.append(sky);
 }
 if(['rain','storm','sleet'].includes(e.weather)){
  for(let i=0;i<24;i++){
   const lane=element('pillar-rain-lane'+(e.weather==='sleet'&&i%2?' is-sleet':''));
   lane.style.setProperty('--x',(17+(i*37)%66)+'%');lane.style.setProperty('--delay',(-i*.47)+'s');lane.style.setProperty('--fall',(.85+(i%5)*.13)+'s');lane.style.setProperty('--bounce',(i%2?-1:1));
   lane.append(element('pillar-raindrop'),element('pillar-splash'));
   (i%3===0?back:front).append(lane);
  }
 }else{
  if(['snow','sandstorm'].includes(e.weather))for(let i=0;i<32;i++){const p=document.createElement('i');p.style.setProperty('--x',((i*37)%101)+'%');p.style.setProperty('--delay',String(-(i*1.37)%9)+'s');p.style.setProperty('--fall',(.7+(i%7)*.17)+'s');p.style.setProperty('--size',(2+i%4)+'px');weather.append(p)}
  front.append(weather);
 }
}
