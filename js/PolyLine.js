import Coordinate from './Coordinate.js';

class PolyLine {
    /** @type {Coordinate[]} */
    points;

    /** @type {Boolean} */
    isClosed;

    constructor() {
        this.points = [];
        this.isClosed = false;
    }
}

export default PolyLine;