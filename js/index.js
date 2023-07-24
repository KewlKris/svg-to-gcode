import ParsedPath from './ParsedPath.js';
import PrintSettings from './PrintSettings.js';
import GCodeGenerator from './GCodeGenerator.js';
import SVGParser from './SVGParser.js';
import Matrix from './Matrix.js';

const SVG = ``;

function hydrate() {
    let svg = new SVGParser(SVG);

    let settings = new PrintSettings();
    settings.drawHeight = 11.7;
    settings.liftAmount = 1;
    settings.travelLiftAmount = 15;
    settings.acceleration = {
        x: 500,
        y: 500,
        z: 500,
    };
    settings.jerk = {
        x: 8,
        y: 8,
        z: 0.4,
    };
    settings.penOffset = {
        x: 50,
        y: 0,
    };
    settings.flip = {
        x: false,
        y: true,
    }
    settings.penSize = 0.1;
    settings.fillOverlap = 0.1;

    let generator = new GCodeGenerator(settings, svg.paths, {x: svg.width, y: svg.height});
    let gcode = generator.generate();
    console.log('G-Code:');
    console.log(gcode);
}
hydrate();