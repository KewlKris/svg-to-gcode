class PrintSettings {
    /** @type {Number} */
    drawHeight;

    /** @type {Number} */
    liftAmount;

    /** @type {{x: Number, y: Number, z: Number}} */
    acceleration;

    /** @type {{x: Number, y: Number, z: Number}} */
    jerk;

    /** @type {{x: Number, y: Number}} */
    penOffset;

    /** @type {{x: Boolean, y: Boolean}} */
    flip;

    /** @type {Number} */
    penSize;

    /** @type {Number} */
    fillOverlap;

    constructor() {
        this.drawHeight = 0;
        this.liftAmount = 5;
        this.travelLiftAmount = 15;
        this.acceleration = {
            x: 500,
            y: 500,
            z: 100,
        };
        this.jerk = {
            x: 8,
            y: 8,
            z: 0.4,
        };
        this.penOffset = {
            x: 0,
            y: 0,
        };
        this.flip = {
            x: false,
            y: true,
        };
        this.penSize = 0.2; // Diameter in mm
        this.fillOverlap = 0.1; // Overlap in percent
    }
}

export default PrintSettings;