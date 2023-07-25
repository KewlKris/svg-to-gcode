import ParsedPath from './ParsedPath.js';
import PrintSettings from './PrintSettings.js';
import GCodeGenerator from './GCodeGenerator.js';
import SVGParser from './SVGParser.js';
import Matrix from './Matrix.js';
import GCodePreview from './GCodePreview.js';

const el = e => document.getElementById(e);
let SETTINGS = undefined;
let SVG = undefined;
let GCODE = undefined;
let STATE = 'WAITING_FOR_FILE'; /** @type {'WAITING_FOR_FILE' | 'READY_TO_PARSE' | 'GENERATING' | 'READY_TO_DOWNLOAD'} */
let FILE_NAME = undefined;
let PREVIEW = undefined;

function initialize() {
   // Initialize settings
   storageToSettings();
   if (!SETTINGS) loadDefaultSettings(); // First page load, or local storage disabled
   settingsToDOM();

   // Add event listeners
   el('reset-button').addEventListener('click', () => {
      loadDefaultSettings();
      settingsToDOM();
      settingsToStorage();
      settingsAdjusted();
   });

   el('main-settings').addEventListener('change', () => {
      domToSettings();
      settingsToStorage();
      settingsAdjusted();
   });

   el('extra-settings').addEventListener('change', () => {
      domToSettings();
      settingsToStorage();
      settingsAdjusted();
   });

   el('file-input').addEventListener('change', () => {
      loadSVG();
   });

   el('generate-button').addEventListener('click', () => {
      switch (STATE) {
         case 'READY_TO_PARSE':
            generateGCode();
            break;
         case 'READY_TO_DOWNLOAD':
            downloadGCode();
            break;
      }
   });

   // Update generate button
   updateGenerateButton();
   setTimeout(() => el('generate-button').classList.add('generate-button-enable-transitions'), 100);

   // Initialize G-Code preview
   PREVIEW = new GCodePreview(el('preview-div'));
}
initialize();

function settingsAdjusted() {
   if (SVG) {
      STATE = 'READY_TO_PARSE';
   } else {
      STATE = 'WAITING_FOR_FILE';
   }
   updateGenerateButton();
}

async function loadSVG() {
   SVG = undefined;
   try {
      let file = el('file-input').files[0];
      let svgText = await file.text();
      FILE_NAME = file.name.substring(0, file.name.lastIndexOf('.'));
      SVG = new SVGParser(svgText);
      updateStats();
      STATE = 'READY_TO_PARSE';
      updateGenerateButton();
   } catch (_) {
      alert('SVG Parse error! Malformed SVG?');
   }
}

function updateStats() {
   if (SVG) {
      el('info-dimensions').innerText = `${SVG.width}mm x ${SVG.height}mm`;
      el('info-pathCount').innerText = SVG.paths.length;
   } else {
      el('info-dimensions').innerText = '?';
      el('info-pathCount').innerText = '?';
   }
}

function generateGCode() {
   if (!SVG) return;

   STATE = 'GENERATING';
   updateGenerateButton();

   let settings = new PrintSettings();
   settings.drawHeight = SETTINGS.drawHeight;
   settings.liftAmount = SETTINGS.liftAmount;
   settings.travelLiftAmount = SETTINGS.travelLiftAmount;
   settings.penSize = SETTINGS.penSize;
   settings.fillOverlap = SETTINGS.fillOverlap;
   settings.acceleration.x = SETTINGS.acceleration.x;
   settings.acceleration.y = SETTINGS.acceleration.y;
   settings.acceleration.z = SETTINGS.acceleration.z;
   settings.jerk.x = SETTINGS.jerk.x;
   settings.jerk.y = SETTINGS.jerk.y;
   settings.jerk.z = SETTINGS.jerk.z;
   settings.penOffset.x = SETTINGS.penOffset.x;
   settings.penOffset.y = SETTINGS.penOffset.y;
   settings.flip.x = SETTINGS.flip.x;
   settings.flip.y = SETTINGS.flip.y;

   let generator = new GCodeGenerator(settings, SVG.paths, {x: SVG.width, y: SVG.height});
   GCODE = generator.generate();

   STATE = 'READY_TO_DOWNLOAD';
   updateGenerateButton();

   PREVIEW.drawGCode(SVG, settings, GCODE);
}

function updateGenerateButton() {
   let button = el('generate-button');
   let text = el('generate-button-text');

   switch (STATE) {
      case 'WAITING_FOR_FILE':
         button.classList.remove('generate-button-enabled');
         button.classList.add('generate-button-disabled');
         text.innerText = 'Waiting for SVG';
         break;
      case 'READY_TO_PARSE':
         button.classList.add('generate-button-enabled');
         button.classList.remove('generate-button-disabled');
         text.innerText = 'Generate G-Code';
         break;
      case 'GENERATING':
         button.classList.remove('generate-button-enabled');
         button.classList.add('generate-button-disabled');
         text.innerText = 'Loading';
         break;
      case 'READY_TO_DOWNLOAD':
         button.classList.add('generate-button-enabled');
         button.classList.remove('generate-button-disabled');
         text.innerText = 'Download G-Code';
         break;
   }
}

function loadDefaultSettings() {
   SETTINGS = {
      drawHeight: 0,
      liftAmount: 1,
      travelLiftAmount: 15,
      penSize: 0.1,
      fillOverlap: 0.1,
      acceleration: {
         x: 500,
         y: 500,
         z: 500,
      },
      jerk: {
         x: 8,
         y: 8,
         z: 0.4,
      },
      penOffset: {
         x: 0,
         y: 0
      },
      flip: {
         x: false,
         y: true,
      }
   };
}

function settingsToDOM() {
   el('setting-drawHeight').value = SETTINGS.drawHeight;
   el('setting-liftAmount').value = SETTINGS.liftAmount;
   el('setting-travelLiftAmount').value = SETTINGS.travelLiftAmount;
   el('setting-penSize').value = SETTINGS.penSize;
   el('setting-fillOverlap').value = SETTINGS.fillOverlap * 100;
   el('setting-accelerationX').value = SETTINGS.acceleration.x;
   el('setting-accelerationY').value = SETTINGS.acceleration.y;
   el('setting-accelerationZ').value = SETTINGS.acceleration.z;
   el('setting-jerkX').value = SETTINGS.jerk.x;
   el('setting-jerkY').value = SETTINGS.jerk.y;
   el('setting-jerkZ').value = SETTINGS.jerk.z;
   el('setting-penOffsetX').value = SETTINGS.penOffset.x;
   el('setting-penOffsetY').value = SETTINGS.penOffset.y;
   el('setting-flipX').checked = SETTINGS.flip.x;
   el('setting-flipY').checked = SETTINGS.flip.y;
}

function domToSettings() {
   SETTINGS.drawHeight = el('setting-drawHeight').value;
   SETTINGS.liftAmount = el('setting-liftAmount').value;
   SETTINGS.travelLiftAmount = el('setting-travelLiftAmount').value;
   SETTINGS.penSize = el('setting-penSize').value;
   SETTINGS.fillOverlap = el('setting-fillOverlap').value / 100;
   SETTINGS.acceleration.x = el('setting-accelerationX').value;
   SETTINGS.acceleration.y = el('setting-accelerationY').value;
   SETTINGS.acceleration.z = el('setting-accelerationZ').value;
   SETTINGS.jerk.x = el('setting-jerkX').value;
   SETTINGS.jerk.y = el('setting-jerkY').value;
   SETTINGS.jerk.z = el('setting-jerkZ').value;
   SETTINGS.penOffset.x = el('setting-penOffsetX').value;
   SETTINGS.penOffset.y = el('setting-penOffsetY').value;
   SETTINGS.flip.x = el('setting-flipX').checked;
   SETTINGS.flip.y = el('setting-flipY').checked;
}

function settingsToStorage() {
   try {
      window.localStorage.setItem('settings', JSON.stringify(SETTINGS));
   } catch (_) {}
}

function storageToSettings() {
   try {
      SETTINGS = JSON.parse(window.localStorage.getItem('settings'));
   } catch (_) {}
}

function downloadGCode() {
   if (!GCODE) return;

   let blob = new Blob([GCODE]);
   let url = URL.createObjectURL(blob);
   let a = document.createElement('a');
   a.href = url;
   a.download = FILE_NAME + '.gcode';
   document.body.appendChild(a);
   a.dispatchEvent(
      new MouseEvent('click', {
         bubbles: true,
         cancelable: true,
         view: window
      })
   );
   document.body.removeChild(a);
}