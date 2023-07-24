import ParsedPath from './ParsedPath.js';
import PrintStyle from './PrintStyle.js';

class SVGParser {
    /** @type {ParsedPath[]} */
    paths;

    /** @type {Number} */
    width;

    /** @type {Number} */
    height;

    /**
     * @param {String} svgText 
     */
    constructor(svgText) {
        let paths = [];
        let parser = new DOMParser();
        let svg = parser.parseFromString(svgText, 'image/svg+xml');
        
        this.width = svg.querySelector('svg').width.baseVal.valueInSpecifiedUnits;
        this.height = svg.querySelector('svg').height.baseVal.valueInSpecifiedUnits;

        for (let path of svg.querySelectorAll('path')) {
            let matrix = path.transform?.baseVal[0]?.matrix;
            let pathData = path.getAttribute('d');
            let style = new PrintStyle();
            style.strokeColor = (path.style.stroke != 'none') ? 0 : undefined;
            style.fillColor = (path.style.fill != 'none') ? 0 : undefined;
            
            paths.push(new ParsedPath(path.id, 0.1, style, pathData, matrix));
        }

        this.paths = paths;
    }
}

export default SVGParser;