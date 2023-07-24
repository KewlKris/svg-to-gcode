class Vector2D {
    /** @type {Number} */
    x;

    /** @type {Number} */
    y;

    /**
     * @param {Number} x 
     * @param {Number} y 
     */
    constructor(x, y,) {
        this.x = x;
        this.y = y;
    }

    /**
     * @returns {Number}
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * @param {Vector2D} vector 
     * @returns {Number}
     */
    dotProduct(vector) {
        return ((this.x * vector.x) + (this.y * vector.y));
    }

    /**
     * @param {Vector2D} vector 
     * @returns {Number}
     */
    angleTo(vector) {
        let value = Math.acos((this.dotProduct(vector))/(this.magnitude() * vector.magnitude()));
        if ((this.x * vector.y) - (this.y * vector.x) < 0) value *= -1;
        return value;
    }
}

export default Vector2D;