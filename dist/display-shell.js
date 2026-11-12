import {createPicker,setupRename} from './display-picker.mjs';
let ready=false;function setup(){if(ready||!window.edgeDisplay?.getState().layoutId)return;ready=true;const context=window.edgeDisplay,picker=createPicker(context);document.querySelector('#addPiece').onclick=()=>picker.open();setupRename(context)}
window.addEventListener('edge:display-ready',setup);setup();
