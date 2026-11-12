import fs from 'node:fs';
for(const file of ['dist/pillars.html','dist/pillar-layout.mjs','dist/assets/pillars-atlas-v1.webp','dist/index.html','dist/wall.js','dist/display.html','dist/rocks.html','dist/rocks.js','dist/rock-layout.mjs','dist/assets/floating-rock-waterfall-v1.webp','dist/assets/floating-rock-ice-v1.webp','dist/assets/floating-rock-lava-v1.webp','dist/display-library.js','dist/display-picker.mjs','dist/displays.css','dist/assets/floating-rock-v1.webp','dist/assets.json','dist/catalog.json'])if(!fs.existsSync(file))throw new Error('Missing '+file);
const assets=JSON.parse(fs.readFileSync('dist/assets.json'));const catalog=JSON.parse(fs.readFileSync('dist/catalog.json'));
if(catalog.some(p=>p.img&&(!assets[p.id]?.src||!fs.existsSync('dist/'+assets[p.id].src))))throw new Error('Preprocessed catalogue assets are incomplete. Run npm run assets.');
console.log('Static assets verified. Netlify bundles API separately.');
