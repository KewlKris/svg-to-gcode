class Coordinate {
    /** @type {Number} */
    x;

    /** @type {Number} */
    y;

    /**
     * @param {Number} x 
     * @param {Number} y 
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Preform a deep copy of this Coordinate
     * @returns {Coordinate}
     */
    clone() {
        return new Coordinate(this.x, this.y);
    }
}

export default Coordinate;