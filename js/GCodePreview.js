import SVGParser from './SVGParser.js';

class GCodePreview {
    /** @type {HTMLDivElement} */
    #div;

    /** @type {HTMLCanvasElement} */
    #canvas;

    /** @type {CanvasRenderingContext2D} */
    #ctx;
    
    /**
     * @param {HTMLDivElement} div 
     */
    constructor(div) {
        this.#div = div;

        let canvas = document.createElement('canvas');
        this.#canvas = canvas;
        this.#ctx = canvas.getContext('2d');

        div.appendChild(canvas);
    }

    /**
     * @param {SVGParser} svg 
     * @param {Object} settings
     * @param {String} gcode 
     */
    drawGCode(svg, settings, gcode) {
        let pxPerMM = (window.devicePixelRatio * 96) / 25.4;

        let width = svg.width * pxPerMM;
        let height = svg.height * pxPerMM;
        this.#canvas.width = width;
        this.#canvas.height = height;

        this.#ctx.fillStyle = 'white';
        this.#ctx.fillRect(0, 0, width, height);

        // Step through G-Code and draw paths to screen
        this.#ctx.strokeStyle = 'black';
        let pos = {
            x: NaN,
            y: NaN,
            z: NaN
        };
        let previousPos = {
            x: NaN,
            y: NaN,
            z: NaN
        };
        let lines = gcode.split('\n');
        for (let line of lines) {
            let params = line.split(' ');
            if (params[0] != 'G0') continue;

            let coordinates = params.slice(1);
            for (let coord of coordinates) {
                switch (coord.charAt(0)) {
                    case 'X':
                        pos.x = new Number(coord.substring(1));
                        break;
                    case 'Y':
                        pos.y = new Number(coord.substring(1));
                        break;
                    case 'Z':
                        pos.z = new Number(coord.substring(1));
                        break;
                }
            }

            if (previousPos.z != settings.drawHeight && pos.z == settings.drawHeight) {
                // Moved on to paper
                this.#ctx.beginPath();
                this.#ctx.moveTo(pos.x * pxPerMM, pos.y * pxPerMM);
            } else if (pos.z == settings.drawHeight && previousPos.z == settings.drawHeight) {
                // Moved across paper
                this.#ctx.lineTo(pos.x * pxPerMM, pos.y * pxPerMM);
            } else if (previousPos.z == settings.drawHeight && pos.z != settings.drawHeight) {
                // Moved off of paper
                this.#ctx.stroke();
            }

            // Update previousPos
            previousPos.x = pos.x;
            previousPos.y = pos.y;
            previousPos.z = pos.z;
        }
    }
}

export default GCodePreview;