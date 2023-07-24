import Coordinate from './Coordinate.js';
import PolyLine from './PolyLine.js';

class ParseState {
    /** @type {String} */
    command;
    
    /** @type {Number[]} */
    parameters;

    /** @type {String} */
    previousCommand;

    /** @type {Coordinate} */
    previousCoords;

    /** @type {Coordinate} */
    initialPoint;

    /** @type {PolyLine} */
    currentPolyLine;

    /** @type {Object} */
    previousPathCommand;

    constructor() {
        this.command = undefined;
        this.parameters = [];
        this.previousCommand = undefined;
        this.previousCoords = new Coordinate(0, 0);
        this.initialPoint = undefined;
        this.currentPolyLine = undefined;
        this.previousPathCommand = undefined;
    }
}

export default ParseState;