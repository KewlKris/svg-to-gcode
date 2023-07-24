class Matrix {
    /** @type {Number} */
    rows;

    /** @type {Number} */
    cols;

    /** @type {Number[][]} */
    values;

    /**
     * @param {Number} rows 
     * @param {Number} cols 
     * @param {Number[]} [values] 
     */
    constructor(rows, cols, values) {
        this.rows = rows;
        this.cols = cols;
        this.values = [];

        for (let i=0; i<cols; i++) {
            let column = [];
            for (let j=0; j<rows; j++) {
                if (values) {
                    column.push(values[i*rows + j]);
                } else {
                    column.push(0);
                }
            }
            this.values.push(column);
        }
    }

    /**
     * @return {Number[]}
     */
    flattenedValues() {
        let values = [];
        for (let i=0; i<this.cols; i++) {
            for (let j=0; j<this.rows; j++) {
                values.push(this.values[i][j]);
            }
        }
        return values;
    }

    /**
     * @returns {Matrix}
     */
    clone() {
        return new Matrix(this.rows, this.cols, this.flattenedValues());
    }

    /**
     * @param {Number} scalar 
     */
    multiplyByScalar(scalar) {
        for (let i=0; i<this.cols; i++) {
            for (let j=0; j<this.rows; j++) {
                this.values[i][j] *= scalar;
            }
        }
    }

    /**
     * @param {Matrix} matrix 
     */
    addMatrix(matrix) {
        if (matrix.rows != this.rows || matrix.cols != this.cols) {
            throw new Error(`Cannot add matrix! Dimensions don't match. (${this.rows}x${this.cols} vs ${matrix.rows}x${matrix.cols})`);
        }

        for (let i=0; i<this.cols; i++) {
            for (let j=0; j<this.rows; j++) {
                this.values[i][j] += matrix.values[i][j];
            }
        }
    }

    /**
     * @param {Matrix} matrix 
     */
    subtractMatrix(matrix) {
        if (matrix.rows != this.rows || matrix.cols != this.cols) {
            throw new Error(`Cannot subtract matrix! Dimensions don't match. (${this.rows}x${this.cols} vs ${matrix.rows}x${matrix.cols})`);
        }

        for (let i=0; i<this.cols; i++) {
            for (let j=0; j<this.rows; j++) {
                this.values[i][j] -= matrix.values[i][j];
            }
        }
    }

    /**
     * @param {Matrix} matrix 
     */
    multipliedByMatrix(matrix) {
        if (matrix.rows != this.cols) {
            throw new Error(`Cannot multiply matrix! Dimensions aren't compatible. (${this.rows}x${this.cols} vs ${matrix.rows}x${matrix.cols})`);
        }

        let resultRows = this.rows;
        let resultCols = matrix.cols;
        let same = this.cols; // or matrix.rows
        let newMatrix = new Matrix(resultRows, resultCols);

        for (let r=0; r<resultRows; r++) {
            for (let c=0; c<resultCols; c++) {
                let sum = 0;
                for (let i=0; i<same; i++) {
                    let left = this.values[i][r];
                    let right = matrix.values[c][i];
                    sum += left * right;
                }
                newMatrix.values[c][r] = sum;
            }
        }

        return newMatrix;
    }
}

export default Matrix;