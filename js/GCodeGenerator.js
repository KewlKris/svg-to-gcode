import PrintSettings from './PrintSettings.js';
import ParsedPath from './ParsedPath.js';
import Coordinate from './Coordinate.js';

class GCodeGenerator {
    /** @type {PrintSettings} */
    #printSettings;

    /** @type {ParsedPath[]} */
    #paths;

    /** @type {{x: Number, y: Number}} */
    #bedSize;

    /** @type {String} */
    #out;

    constructor(printSettings, paths, bedSize) {
        this.#printSettings = printSettings;
        this.#paths = paths;
        this.#bedSize = bedSize;
    }

    /**
     * @returns {String}
     */
    generate() {
        this.#out = '';
        this.#addHeader();
        this.#addLine('');

        for (let i=0; i<this.#paths.length; i++) {
            let path = this.#paths[i];
            this.#addPath(path);

            this.#addLine('');
        }

        this.#addFooter();

        return this.#out;
    }

    #addHeader() {
        let set = this.#printSettings;
        this.#addLine('; First configure the printer');
        this.#addLine(`M201 X${set.acceleration.x} Y${set.acceleration.y} Z${set.acceleration.z} ; Set the maximum accelerations, mm/sec^2`);
        this.#addLine(`M205 X${set.jerk.x} Y${set.jerk.y} Z${set.jerk.z} ; Sets the jerk limits`);
        this.#addLine('G90 ; Use absolute positioning');
        this.#addLine('G21 ; Use millimeter units');
        this.#addLine(`G0 Z${set.drawHeight + set.travelLiftAmount} ; Start pen lifted`);
        this.#addLine(`; Coordinates assume bed dimensions of ${this.#bedSize.x}mm x ${this.#bedSize.y}mm`);
    }

    #addFooter() {
        let set = this.#printSettings;
        this.#addLine(`G0 Z${set.drawHeight + set.travelLiftAmount} ; Lift pen before leaving`);
    }

    /**
     * @param {ParsedPath} path 
     */
    #addPath(path) {
        if (path.printStyle.strokeColor !== undefined || path.printStyle.fillColor !== undefined) {
            this.#strokePath(path);
        }

        if (path.printStyle.fillColor !== undefined) {
            this.#addLine('');
            this.#fillPath(path);
        }
    }

    /**
     * @param {ParsedPath} path 
     */
    #strokePath(path) {
        for (let i=0; i<path.polylines.length; i++) {
            let polyline = path.polylines[i];
            this.#addLine(`; Drawing subpath ${i+1} of ${path.polylines.length} for ${path.name}`);
            let firstPoint = this.#adjustPoint(polyline.points[0]);
            this.#addLine(`G0 X${firstPoint.x} Y${firstPoint.y}`);
            this.#addLine(`G0 Z${this.#printSettings.drawHeight}`);
            
            for (let j=1; j<polyline.points.length; j++) {
                let point = this.#adjustPoint(polyline.points[j]);
                this.#addLine(`G0 X${point.x} Y${point.y}`);
            }
            this.#addLine(`G0 Z${this.#printSettings.drawHeight + this.#printSettings.liftAmount}`);

            if (i != path.polylines.length-1) this.#addLine('');
        }
    }

    /**
     * @param {ParsedPath} path 
     */
    #fillPath(path) {
        // Find all closed polylines
        let closed = [];
        for (let line of path.polylines) if (line.isClosed) closed.push(line);

        // Identify the bounding box of the closed paths
        let topLeft = new Coordinate(path.polylines[0].points[0].x, path.polylines[0].points[0].y);
        let bottomRight = new Coordinate(path.polylines[0].points[0].x, path.polylines[0].points[0].y);
        for (let polyLine of closed) {
            for (let pnt of polyLine.points) {
                if (pnt.x < topLeft.x) topLeft.x = pnt.x;
                if (pnt.y < topLeft.y) topLeft.y = pnt.y;
                if (pnt.x > bottomRight.x) bottomRight.x = pnt.x;
                if (pnt.y > bottomRight.y) bottomRight.y = pnt.y;
            }
        }

        // Compute the fill lines and sections
        let previousFillCount = undefined;
        let completeFillRegions = [];
        let currentFillRegions = [];
        let goingForward = true;
        let xStep = this.#printSettings.penSize * (1-this.#printSettings.fillOverlap);
        for (let x=topLeft.x; x<=bottomRight.x; x += xStep) {
            let startPoint = new Coordinate(x, topLeft.y);
            let endPoint = new Coordinate(x, bottomRight.y);

            let collisionPoints = [];
            for (let polyLine of closed) {
                for (let i=0; i<polyLine.points.length-1; i++) {
                    let collision = this.#getLineIntersection(startPoint, endPoint, polyLine.points[i], polyLine.points[i+1]);
                    if (collision) collisionPoints.push(collision);
                }
            }

            // Sort collisions by distance to start point
            let compare = (a, b) => (this.#distance(startPoint, a) - this.#distance(startPoint, b));
            collisionPoints.sort(compare);

            // Calculate fill regions
            let fillLines = [];
            for (let i=0; i<collisionPoints.length-1; i++) {
                let first = collisionPoints[i];
                let second = collisionPoints[i+1];

                if (((collisionPoints.length - (i+1))%2) == 0) {
                    // This region is outside the path! Skip
                    continue;
                }

                let fillLine;
                if (goingForward) {
                    fillLine = {start: first, end: second};
                } else {
                    fillLine = {start: second, end: first};
                }
                fillLines.push(fillLine);
            }

            let fillCount = fillLines.length;
            if (previousFillCount === undefined) {
                // This is the first iteration
                previousFillCount = fillCount;
                currentFillRegions = Array(fillCount);
                for (let i=0; i<currentFillRegions.length; i++) currentFillRegions[i] = [];
                console.log('Starting with fill count: ' + fillCount);
            } else if (previousFillCount != fillCount) {
                // Fill count changed! Complete current fill regions
                completeFillRegions.push(...currentFillRegions);
                currentFillRegions = Array(fillCount);
                for (let i=0; i<currentFillRegions.length; i++) currentFillRegions[i] = [];
                previousFillCount = fillCount;
                goingForward = true;
                console.log('Moving to fill count: ' + fillCount);
            }

            // Add the fill lines to the current fill regions
            for (let i=0; i<fillLines.length; i++) {
                currentFillRegions[i].push(fillLines[i]);
            }

            goingForward = !goingForward;
        }

        // Complete any last fill regions
        completeFillRegions.push(...currentFillRegions);

        // Add instructions for fill regions
        for (let i=0; i<completeFillRegions.length; i++) {
            this.#addLine(`; Drawing fill region ${i+1} of ${completeFillRegions.length} for ${path.name}`);
            let region = completeFillRegions[i];
            let firstPoint = this.#adjustPoint(region[0].start);
            this.#addLine(`G0 X${firstPoint.x} Y${firstPoint.y}`);
            this.#addLine(`G0 Z${this.#printSettings.drawHeight}`);

            // Draw region
            for (let j=0; j<region.length; j++) {
                let destPoint = this.#adjustPoint(region[j].end);
                this.#addLine(`G0 X${destPoint.x} Y${destPoint.y}`);

                if (j != region.length-1) {
                    // Move to the next start
                    let nextStart = this.#adjustPoint(region[j+1].start);
                    this.#addLine(`G0 X${nextStart.x} Y${nextStart.y}`);
                }
            }

            // Lift off paper
            this.#addLine(`G0 Z${this.#printSettings.drawHeight + this.#printSettings.liftAmount}`);
        }
    }

    #addLine(text) {
        this.#out += text + '\n';
    }

    /**
     * @param {Coordinate} pnt
     * @returns {Coordinate}
     */
    #adjustPoint(pnt) {
        pnt = pnt.clone();
        pnt.x -= this.#printSettings.penOffset.x;
        pnt.y -= this.#printSettings.penOffset.y;

        if (this.#printSettings.flip.x) {
            pnt.x = this.#bedSize.x - pnt.x;
        }
        if (this.#printSettings.flip.y) {
            pnt.y = this.#bedSize.y - pnt.y;
        }

        return pnt;
    }

    /**
     * @param {Coordinate} p1 
     * @param {Coordinate} p2 
     * @returns {Number}
     */
    #distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Calculates the intersection between two line segments
     * Adapted from: https://stackoverflow.com/a/1968345
     * @param {Coordinate} p1 
     * @param {Coordinate} p2 
     * @param {Coordinate} p3 
     * @param {Coordinate} p4 
     * @returns {Coordinate | undefined}
     */
    #getLineIntersection(p1, p2, p3, p4) {
        let s1x = p2.x - p1.x;
        let s1y = p2.y - p1.y;
        let s2x = p4.x - p3.x;
        let s2y = p4.y - p3.y;
        let s = (-s1y * (p1.x - p3.x) + s1x * (p1.y - p3.y)) / (-s2x * s1y + s1x * s2y);
        let t = ( s2x * (p1.y - p3.y) - s2y * (p1.x - p3.x)) / (-s2x * s1y + s1x * s2y);
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            // Collision detected
            let intX = p1.x + (t * s1x);
            let intY = p1.y + (t * s1y);
            return new Coordinate(intX, intY);
        }

        // No collision
        return undefined;
    }
}

export default GCodeGenerator;