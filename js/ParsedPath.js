import ParseState from './ParseState.js';
import Coordinate from './Coordinate.js';
import PolyLine from './PolyLine.js';
import Matrix from './Matrix.js';
import Vector2D from './Vector2D.js';
import PrintStyle from './PrintStyle.js';

const COMMANDS = 'mlhvcsqtazMLHVCSQTAZ';
const DIGITS = '0123456789-.eE';
const WHITESPACES = ', \n';
const SAMPLE_SEGMENTS = 10;

class ParsedPath {
    /** @type {PolyLine[]} */
    polylines;

    /** @type {String} */
    name;
    
    /** @type {PrintStyle} */
    printStyle;

    /** @type {ParseState} */
    #state;

    /** @type {String} */
    #numberBuffer;

    /** @type {Number} */
    #resolution;

    /** @type {{a: Number, b: Number, c: Number, d: Number, e: Number, f: Number}} */
    #matrix;

    /**
     * @param {String} name
     * @param {Number} resolution
     * @param {PrintStyle} printStyle
     * @param {String} svgPath 
     * @param {{a: Number, b: Number, c: Number, d: Number, e: Number, f: Number}} [matrix]
     */
    constructor(name, resolution, printStyle, svgPath, matrix) {
        this.name = name;
        this.#resolution = resolution;
        this.printStyle = printStyle;
        this.#matrix = matrix;
        this.polylines = [];
        this.#state = new ParseState();
        this.#numberBuffer = '';

        for (let c of svgPath) {
            if (COMMANDS.indexOf(c) != -1) {
                // Try to close the parameter
                this.#closeParameter(true);

                // Generate new state
                if (this.#state.command == undefined) {
                    this.#state.previousCommand = this.#state.command;
                    this.#state.command = c;
                } else {
                    throw new Error('Parse error! Unexpected command: ' + c);
                }
            } else if (DIGITS.indexOf(c) != -1) {
                // This is part of a parameter
                this.#numberBuffer += c;
            } else if (WHITESPACES.indexOf(c) != -1) {
                // Try to close the parameter
                this.#closeParameter(false);
            }
        }
        // Close anything left
        this.#closeParameter(true);

        if (this.#state.previousCommand.toUpperCase() != 'Z') {
            // Save this as an open path
            this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
            this.#state.currentPolyLine.isClosed = false;
            this.polylines.push(this.#state.currentPolyLine);
        }
    }

    /**
     * @param {Boolean} endOfParams 
     */
    #closeParameter(endOfParams) {
        if (this.#numberBuffer.length != 0) {
            // This is completing a parameter
            let value = Number.parseFloat(this.#numberBuffer);
            this.#numberBuffer = '';

            // Add this to the parameters list
            if (this.#state.command != undefined) {
                // This parameter follows a command
                this.#state.parameters.push(value);
            } else {
                // This parameter has no defined command. Use the previous one.
                let newCommand = this.#state.previousCommand;
                if (newCommand == 'M') newCommand = 'L';
                else if (newCommand == 'm') newCommand = 'l';

                // Begin a new state
                this.#state.command = newCommand;
                this.#state.parameters = [value];
            }
        }

        // Check if the command is now complete
        if (this.#state.command) {
            let pathCommand = undefined;
            let isRelative = (COMMANDS.indexOf(this.#state.command) < COMMANDS.length/2);
            switch (this.#state.command.toUpperCase()) {
                case 'M':
                    if (this.#state.parameters.length == 2) {
                        let coords = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        if (isRelative) {
                            coords.x += this.#state.previousCoords.x;
                            coords.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'MoveTo',
                            coords
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = coords.clone();
                    }
                    break;
                case 'L':
                    if (this.#state.parameters.length == 2) {
                        let coords = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        if (isRelative) {
                            coords.x += this.#state.previousCoords.x;
                            coords.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'LineTo',
                            coords
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = coords.clone();
                    }
                    break;
                case 'H':
                    if (this.#state.parameters.length == 1) {
                        let xCoord = this.#state.parameters[0];
                        if (isRelative) {
                            xCoord += this.#state.previousCoords.x;
                        }

                        pathCommand = {
                            type: 'HorizontalLine',
                            xCoord
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords.x = xCoord;
                    }
                    break;
                case 'V':
                    if (this.#state.parameters.length == 1) {
                        let yCoord = this.#state.parameters[0];
                        if (isRelative) {
                            yCoord += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'VerticalLine',
                            yCoord
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords.y = yCoord;
                    }
                    break;
                case 'C':
                    if (this.#state.parameters.length == 6) {
                        let cp1 = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        let cp2 = new Coordinate(this.#state.parameters[2], this.#state.parameters[3]);
                        let xy = new Coordinate(this.#state.parameters[4], this.#state.parameters[5]);
                        if (isRelative) {
                            cp1.x += this.#state.previousCoords.x;
                            cp1.y += this.#state.previousCoords.y;
                            cp2.x += this.#state.previousCoords.x;
                            cp2.y += this.#state.previousCoords.y;
                            xy.x += this.#state.previousCoords.x;
                            xy.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'CubicBezier',
                            cp1,
                            cp2,
                            xy,
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = xy.clone();
                    }
                    break;
                case 'S':
                    if (this.#state.parameters.length == 4) {
                        // First control point is a reflection of the 2nd control point from the previous path command
                        let cp1 = undefined;
                        if (this.#state.previousCommand?.toUpperCase() == 'C' || this.#state.previousCommand?.toUpperCase() == 'S') {
                            // Control point is a reflection
                            cp1 = this.#reflectPoint(this.#state.previousPathCommand.cp2, this.#state.previousCoords);
                        } else {
                            // Control point is located at the start point
                            cp1 = this.#state.previousCoords.clone();
                        }

                        let cp2 = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        let xy = new Coordinate(this.#state.parameters[2], this.#state.parameters[3]);
                        if (isRelative) {
                            cp2.x += this.#state.previousCoords.x;
                            cp2.y += this.#state.previousCoords.y;
                            xy.x += this.#state.previousCoords.x;
                            xy.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'CubicBezier',
                            cp1,
                            cp2,
                            xy,
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = xy.clone();
                    }
                    break;
                case 'Q':
                    if (this.#state.parameters.length == 4) {
                        let cp = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        let xy = new Coordinate(this.#state.parameters[2], this.#state.parameters[3]);
                        if (isRelative) {
                            cp.x += this.#state.previousCoords.x;
                            cp.y += this.#state.previousCoords.y;
                            xy.x += this.#state.previousCoords.x;
                            xy.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'QuadraticBezier',
                            cp,
                            xy,
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = xy.clone();
                    }
                    break;
                case 'T':
                    if (this.#state.parameters.length == 2) {
                        // First control point is a reflection of the 2nd control point from the previous path command
                        let cp = undefined;
                        if (this.#state.previousCommand?.toUpperCase() == 'Q' || this.#state.previousCommand?.toUpperCase() == 'T') {
                            // Control point is a reflection
                            cp = this.#reflectPoint(this.#state.previousPathCommand.cp, this.#state.previousCoords);
                        } else {
                            // Control point is located at the start point
                            cp = this.#state.previousCoords.clone();
                        }

                        let xy = new Coordinate(this.#state.parameters[0], this.#state.parameters[1]);
                        if (isRelative) {
                            xy.x += this.#state.previousCoords.x;
                            xy.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'QuadraticBezier',
                            cp,
                            xy,
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = xy.clone();
                    }
                    break;
                case 'A':
                    if (this.#state.parameters.length == 7) {
                        let rx = this.#state.parameters[0];
                        let ry = this.#state.parameters[1];
                        let rotation = this.#state.parameters[2];
                        let largeArcFlag = this.#state.parameters[3];
                        let sweepFlag = this.#state.parameters[4];
                        let xy = new Coordinate(this.#state.parameters[5], this.#state.parameters[6]);
                        if (isRelative) {
                            xy.x += this.#state.previousCoords.x;
                            xy.y += this.#state.previousCoords.y;
                        }

                        pathCommand = {
                            type: 'Arc',
                            rx, ry, rotation, largeArcFlag, sweepFlag, xy
                        };
                        this.#extendPolyline(pathCommand);

                        this.#state.previousCoords = xy.clone();
                    }
                    break;
                case 'Z':
                    pathCommand = {
                        type: 'ClosePath',
                    }
                    this.#extendPolyline(pathCommand);

                    this.#state.previousCoords = this.#state.initialPoint.clone();
                    break;
                default:
                    throw new Error('Parse error! Unrecognized command: ' + this.#state.command);
            }

            // If a command was found, reset the state
            if (pathCommand) {
                console.log('Got command!');
                console.log(pathCommand);

                // Reset state
                this.#state.previousCommand = this.#state.command;
                this.#state.previousPathCommand = pathCommand;
                this.#state.command = undefined;
                this.#state.parameters = [];
            }
        }
    }

    #extendPolyline(pathCommand) {
        switch (pathCommand.type) {
            case 'MoveTo':
                if (this.#state.currentPolyLine) {
                    if (this.#state.currentPolyLine.points.length != 0) {
                        // Save this as an open path
                        this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
                        this.#state.currentPolyLine.isClosed = false;
                        this.polylines.push(this.#state.currentPolyLine);
                    }
                }

                this.#state.currentPolyLine = new PolyLine();
                this.#state.initialPoint = pathCommand.coords.clone();
                break;
            case 'LineTo':
                this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
                break;
            case 'HorizontalLine':
                this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
                break;
            case 'VerticalLine':
                this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
                break;
            case 'CubicBezier':
                {
                    let estimationPoints = this.#pointsAlongCubicBezier(SAMPLE_SEGMENTS, this.#state.previousCoords, pathCommand.cp1, pathCommand.cp2, pathCommand.xy);
                    estimationPoints = estimationPoints.map(pnt => this.#applyMatrix(pnt));
                    let estimationLength = this.#distanceOfPoints(estimationPoints);
                    let estimatedSegments = estimationLength / this.#resolution;
                    let curvePoints = this.#pointsAlongCubicBezier(estimatedSegments, this.#state.previousCoords, pathCommand.cp1, pathCommand.cp2, pathCommand.xy);
                    curvePoints = curvePoints.map(pnt => this.#applyMatrix(pnt));
                    this.#state.currentPolyLine.points.push(...curvePoints.slice(0, -1));
                }
                break;
            case 'QuadraticBezier':
                {
                    let estimationPoints = this.#pointsAlongQuadraticBezier(SAMPLE_SEGMENTS, this.#state.previousCoords, pathCommand.cp, pathCommand.xy);
                    estimationPoints = estimationPoints.map(pnt => this.#applyMatrix(pnt));
                    let estimationLength = this.#distanceOfPoints(estimationPoints);
                    let estimatedSegments = estimationLength / this.#resolution;
                    let curvePoints = this.#pointsAlongQuadraticBezier(estimatedSegments, this.#state.previousCoords, pathCommand.cp, pathCommand.xy);
                    curvePoints = curvePoints.map(pnt => this.#applyMatrix(pnt));
                    this.#state.currentPolyLine.points.push(...curvePoints.slice(0, -1));
                }
                break;
            case 'Arc':
                {
                    // Destructure all values
                    let x1 = this.#state.previousCoords.x;
                    let y1 = this.#state.previousCoords.y;
                    let x2 = pathCommand.xy.x;
                    let y2 = pathCommand.xy.y;
                    let rx = pathCommand.rx;
                    let ry = pathCommand.ry;
                    let rot = this.#degToRad(pathCommand.rotation);

                    // First compute the center point of the arc
                    let trigMatrix = new Matrix(2, 2, [Math.cos(rot), -Math.sin(rot), Math.sin(rot), Math.cos(rot)]);
                    let halfMatrix = new Matrix(2, 1, [(x1-x2)/2, (y1-y2)/2]);
                    let [xPrime, yPrime] = trigMatrix.multipliedByMatrix(halfMatrix).flattenedValues();

                    let rx2 = rx * rx;
                    let ry2 = ry * ry;
                    let xPrime2 = xPrime * xPrime;
                    let yPrime2 = yPrime * yPrime;
                    let root = Math.sqrt((rx2*ry2 - rx2*yPrime2 - ry2*xPrime2) / (rx2*yPrime2 + ry2*xPrime2));
                    if (pathCommand.largeArcFlag == pathCommand.sweepFlag) root *= -1;
                    let split = new Matrix(2, 1, [(rx*yPrime)/ry, -(ry*xPrime)/rx]);
                    split.multiplyByScalar(root);
                    let [cxPrime, cyPrime] = split.flattenedValues();

                    let trigMatrix2 = new Matrix(2, 2, [Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot)]);
                    let cxcy = trigMatrix2.multipliedByMatrix(split);
                    let halfMatrix2 = new Matrix(2, 1, [(x1+x2)/2, (y1+y2)/2]);
                    cxcy.addMatrix(halfMatrix2);
                    let [cx, cy] = cxcy.flattenedValues();

                    // Now compute angles
                    let unitVector = new Vector2D(1, 0);
                    let vec1 = new Vector2D((xPrime-cxPrime)/rx, (yPrime-cyPrime)/ry);
                    let vec2 = new Vector2D((-xPrime-cxPrime)/rx, (-yPrime-cyPrime)/ry);
                    let startAngle = unitVector.angleTo(vec1);
                    let sweepAngle = vec1.angleTo(vec2);
                    let endAngle = startAngle + sweepAngle;

                    // Calculate points
                    let estimationPoints = this.#pointsAlongArc(SAMPLE_SEGMENTS, cx, cy, rx, ry, rot, startAngle, endAngle);
                    estimationPoints = estimationPoints.map(pnt => this.#applyMatrix(pnt));
                    let estimationLength = this.#distanceOfPoints(estimationPoints);
                    let estimatedSegments = estimationLength / this.#resolution;
                    let arcPoints = this.#pointsAlongArc(estimatedSegments, cx, cy, rx, ry, rot, startAngle, endAngle);
                    arcPoints = arcPoints.map(pnt => this.#applyMatrix(pnt));
                    this.#state.currentPolyLine.points.push(...arcPoints.slice(0, -1));
                }
                break;
            case 'ClosePath':
                this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.previousCoords));
                this.#state.currentPolyLine.points.push(this.#applyMatrix(this.#state.initialPoint));

                // Save this PolyLine as a closed path
                this.#state.currentPolyLine.isClosed = true;
                this.polylines.push(this.#state.currentPolyLine);
                this.#state.currentPolyLine = undefined;
                break;
            default:
                break;
        }
    }

    /**
     * @param {Coordinate} coord 
     */
    #applyMatrix(coord) {
        if (this.#matrix) {
            let mat = this.#matrix;
            let newCoord = new Coordinate(
                mat.a*coord.x + mat.c*coord.y + mat.e,
                mat.b*coord.x + mat.d*coord.y + mat.f
            );
            return newCoord;
        } else {
            return coord.clone();
        }
    }

    /**
     * @param {Coordinate} start
     * @param {Coordinate} end 
     * @returns {Coordinate[]}
     */
    #linearExtend(start, end) {
        let points = [];
        let dX = end.x - start.x;
        let dY = end.y - start.y;
        let length = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2));

        let segments = length / this.#resolution;
        for (let i=0; i<=segments; i++) {
            let percent = i/segments;
            let newCoord = new Coordinate(start.x + (dX * percent), start.y + (dY * percent));
            points.push(newCoord);
        }

        return points;
    }

    /**
     * @param {Number} t 
     * @param {Number} p0 
     * @param {Number} p1 
     * @param {Number} p2 
     * @param {Number} p3 
     * @returns {Number}
     */
    #cubicBezier(t, p0, p1, p2, p3) {
        return (Math.pow(1-t,3)*p0 + 3*Math.pow(1-t,2)*t*p1 + 3*(1-t)*t*t*p2 + Math.pow(t,3)*p3);
    }

    /**
     * @param {Number} segments
     * @param {Coordinate} start 
     * @param {Coordinate} cp1 
     * @param {Coordinate} cp2 
     * @param {Coordinate} end 
     * @returns {Coordinate[]}
     */
    #pointsAlongCubicBezier(segments, start, cp1, cp2, end) {
        let points = [];
        for (let t=0; t<=1; t += (1 / segments)) {
            let x = this.#cubicBezier(t, start.x, cp1.x, cp2.x, end.x);
            let y = this.#cubicBezier(t, start.y, cp1.y, cp2.y, end.y);
            points.push(new Coordinate(x, y));
        }
        return points;
    }

    /**
     * @param {Number} t 
     * @param {Number} p0 
     * @param {Number} p1 
     * @param {Number} p2 
     * @returns {Number}
     */
    #quadraticBezier(t, p0, p1, p2) {
        return (Math.pow(1-t,2)*p0 + 2*(1-t)*t*p1 + t*t*p2);
    }

    /**
     * @param {Number} segments 
     * @param {Coordinate} start 
     * @param {Coordinate} cp 
     * @param {Coordinate} end 
     * @returns {Coordinate[]}
     */
    #pointsAlongQuadraticBezier(segments, start, cp, end) {
        let points = [];
        for (let t=0; t<=1; t += (1 / segments)) {
            let x = this.#quadraticBezier(t, start.x, cp.x, end.x);
            let y = this.#quadraticBezier(t, start.y, cp.y, end.y);
            points.push(new Coordinate(x, y));
        }
        return points;
    }

    /**
     * @param {Number} cx 
     * @param {Number} cy 
     * @param {Number} rx 
     * @param {Number} ry 
     * @param {Number} rotation 
     * @param {Number} pointAngle 
     * @returns {Coordinate}
     */
    #arc(cx, cy, rx, ry, rotation, pointAngle) {
        let center = new Matrix(2, 1, [cx, cy]);
        let trigMatrix = new Matrix(2, 2, [Math.cos(rotation), Math.sin(rotation), -Math.sin(rotation), Math.cos(rotation)]);
        let radiusMatrix = new Matrix(2, 1, [rx*Math.cos(pointAngle), ry*Math.sin(pointAngle)]);

        let result = trigMatrix.multipliedByMatrix(radiusMatrix);
        result.addMatrix(center);
        let [x, y] = result.flattenedValues();
        return new Coordinate(x, y);
    }

    #pointsAlongArc(segments, cx, cy, rx, ry, rotation, startAngle, endAngle) {
        let points = [];
        let dAngle = endAngle - startAngle;
        let step = dAngle / segments;
        for (let t=0; t<=segments; t++) {
            let pointAngle = startAngle + (step*t);
            points.push(this.#arc(cx, cy, rx, ry, rotation, pointAngle));
        }
        return points;
    }

    /**
     * @param {Coordinate[]} points 
     * @returns {Number}
     */
    #distanceOfPoints(points) {
        let sum = 0;
        for (let i=0; i<points.length-1; i++) {
            sum += Math.sqrt(Math.pow(points[i+1].x - points[i].x, 2) + Math.pow(points[i+1].y - points[i].y, 2));
        }
        return sum;
    }

    /**
     * @param {Coordinate} sourcePoint 
     * @param {Coordinate} aboutPoint 
     * @returns {Coordinate}
     */
    #reflectPoint(sourcePoint, aboutPoint) {
        let newPoint = new Coordinate(
            aboutPoint.x*2 - sourcePoint.x,
            aboutPoint.y*2 - sourcePoint.y,
        );
        return newPoint;
    }

    /**
     * @param {Number} degrees 
     */
    #degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }
}

export default ParsedPath;