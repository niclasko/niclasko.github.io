/*
** Cubic.js - SVG in 3D
** Niclas Kjäll-Ohlsson, 2020
** -------------------------------------------
** References:
** - https://en.wikipedia.org/wiki/3D_projection
** - https://en.wikipedia.org/wiki/Rotation_matrix
*/
function Cubic(_container) {
    var self = this;
    var container = document.getElementById(_container);
    var graphics;

    var scene = [];

    var S = [[1,0,0], [0,1,0]];

    var center = new Point(250,250,0);

    var startMousePoint = [-1,-1];
    var previousMousePoint = [-1,-1];
    var deltaX = 0;
    var deltaY = 0;
    var previousDeltaX = 0;
    var previousDeltaY = 0;

    const DEGREES_PER_RADIAN = Math.PI/180;

    // Rotation matrices
    var Rx = [
        [1,0,0],
        [0, null, null],
        [0, null, null],
    ];

    var Ry = [
        [null,0,null],
        [0, 1, 0],
        [null, 0, null],
    ];


    var XMLNS = "http://www.w3.org/2000/svg";

    var svg = function() {
        return document.createElementNS(XMLNS, "svg");
    };

    var init = function() {
        graphics = svg();
        graphics.style.width = "500px";
        graphics.style.height = "500px";
        graphics.onpointerdown = (event) => startChange(event);
        graphics.onpointerup = (event) => endChange(event);
        container.appendChild(graphics);
    };
    init();

    var startChange = function(event) {
        startMousePoint = [event.x, event.y];
        previousMousePoint =  [event.x, event.y];
        window.onpointermove = (event) => change(event);
    };

    var change = function(event) {
        rotateFromPointDelta(startMousePoint, [event.x, event.y]);
        deltaX = event.x-previousMousePoint[0];
        deltaY = event.y-previousMousePoint[1];
        previousMousePoint =  [event.x, event.y];
        if(deltaX != previousDeltaX || deltaY != previousDeltaY) {
            startMousePoint = [event.x, event.y];
        }
        previousDeltaX = deltaX;
        previousDeltaY = deltaY;
    };

    var endChange = function(event) {
        startMousePoint = [event.x, event.y];
        previousMousePoint =  [event.x, event.y];
        window.onpointermove = null;
    };

    self.createCube = function() {
        scene.push(new Cube(new Point(-55, 80, 0), "orange", self, 50));
        scene.push(new Cube(new Point(0, 25, 0), "blue", self, 50));
        scene.push(new Cube(new Point(55, 80, 0), "red", self, 50));
        scene.push(new Cube(new Point(110, 135, 0), "green", self, 50));
    };

    self.createPlane = function() {
        scene.push(new Plane(new Point(0, 0, 0), "lightgray", self, 300));
    };

    self.create3DObject = function() {
        scene.push(new _3DObject(new Point(0, 0, 0), "black", self));
    };

    self.addGraphics = function(_graphics) {
        graphics.appendChild(_graphics);
    };

    self.center = function() {
        return center;
    };

    var rotateX = function(d) {
        Rx[1][1] = Math.cos(d);
        Rx[1][2] = -Math.sin(d);
        Rx[2][1] = Math.sin(d);
        Rx[2][2] = Math.cos(d);
    };

    var rotateY = function(d) {
        Ry[0][0] = Math.cos(d);
        Ry[0][2] = Math.sin(d);
        Ry[2][0] = -Math.sin(d);
        Ry[2][2] = Math.cos(d);
    };

    var applyRotation = function() {
        for(var i=0; i<scene.length; i++) {
            scene[i].rotate(Rx);
            scene[i].rotate(Ry);
            scene[i].render();
        }
    };

    var rotateFromPointDelta = function(p1, p2) {
        rotateScene(
            .5*(p1[1]-p2[1])*DEGREES_PER_RADIAN,
            -.5*(p1[0]-p2[0])*DEGREES_PER_RADIAN
        );
    };

    var rotateScene = function(rx, ry) {
        rotateX(rx);
        rotateY(ry);
        applyRotation();
    };

    self.rotate = function(dx, dy) {
        rotateScene(
            dx*DEGREES_PER_RADIAN,
            dy*DEGREES_PER_RADIAN
        );
    };

    function Primitive(_color, _parent) {
        var self = this;
        var color = _color;
        var parent = _parent;
        var graphics;

        self.graphics = function() {
            return graphics;
        };

        self.setGraphics = function(_graphics) {
            graphics = _graphics;
        };

        self.color = function() {
            return color;
        };

        self.render = function() {
            ;
        };

        self.parent = function() {
            return parent;
        };
    };

    function Object(_center, _color, _parent) {
        Primitive.call(this, _color, _parent);
        var self = this;
        var center = _center;

        self.center = function() {
            return center;
        };
    };

    function _3DObject(_center, _color, _parent) {
        Object.call(this, _center, _color, _parent);
        var self = this;

        var vertices = [
            0.5,-0.5,0.5,
            0.5,0.5,0.5,
            0.5,-0.5,-0.5,
            0.5,0.5,-0.5,
            -0.5,0.5,0.5,
            -0.5,-0.5,0.5,
            -0.5,0.5,-0.5,
            -0.5,-0.5,-0.5
        ];

        var edges = [];

        var points = new Array(vertices.length/3);

        var init = function() {
            var ix;
            for(var i=0; i<(vertices.length/3); i++) {
                ix = i*3;
                points[i] = new Point(
                    self.parent().center().x()-(vertices[ix]*50),
                    self.parent().center().y()-(vertices[ix+1]*50),
                    self.parent().center().z()-(vertices[ix+2]*50),
                    self.parent().center()
                );
            }

            for(var i=0; i<(points.length-1); i++) {
                for(var j=(i+1); j<points.length; j++) {
                    edges.push(new Line(points[i], points[j], self.color(), self.parent()));
                }
            }

            createGraphics();
            self.parent().addGraphics(self.graphics());
            self.render();
        };

        var createGraphics = function() {
            self.setGraphics(document.createElementNS(XMLNS, "g"));
            for(var i=0; i<edges.length; i++) {
                self.graphics().appendChild(edges[i].graphics());
            }
        };

        self.rotate = function(R) {
            for(var i=0; i<points.length; i++) {
                points[i].rotate(R);
            }
        };

        self.render = function() {
            for(var i=0; i<edges.length; i++) {
                edges[i].render();
            }
        };

        init();
    };

    function Plane(_center, _color, _parent, _size) {
        Object.call(this, _center, _color, _parent);
        var self = this;
        var size = _size;

        var points = new Array(4);
        var lines = new Array(4);

        var init = function() {
            var half = size/2;

            var c = new Point(
                self.parent().center().x()-self.center().x(),
                self.parent().center().y()-self.center().y(),
                self.parent().center().z()-self.center().z()
            );

            points[0] = new Point(c.x()-half, c.y(), c.z()+half, self.parent().center());
            points[1] = new Point(c.x()-half, c.y(), c.z()-half, self.parent().center());
            points[2] = new Point(c.x()+half, c.y(), c.z()+half, self.parent().center());
            points[3] = new Point(c.x()+half, c.y(), c.z()-half, self.parent().center());

            lines[0] = new Line(points[0], points[1], self.color(), self.parent());
            lines[1] = new Line(points[1], points[3], self.color(), self.parent());
            lines[2] = new Line(points[2], points[0], self.color(), self.parent());
            lines[3] = new Line(points[3], points[2], self.color(), self.parent());

            createGraphics();

            self.parent().addGraphics(self.graphics());
            self.render();
        };

        var createGraphics = function() {
            self.setGraphics(document.createElementNS(XMLNS, "g"));
            for(var i=0; i<lines.length; i++) {
                self.graphics().appendChild(lines[i].graphics());
            }
        };

        self.rotate = function(R) {
            for(var i=0; i<points.length; i++) {
                points[i].rotate(R);
            }
        };

        self.render = function() {
            for(var i=0; i<lines.length; i++) {
                lines[i].render();
            }
        };

        init();
    };

    function Cube(_center, _color, _parent, _size) {
        Object.call(this, _center, _color, _parent);
        var self = this;
        var size = _size;

        var points = new Array(8);
        var lines = new Array(12);

        var init = function() {
            var half = size/2;

            var c = new Point(
                self.parent().center().x()-self.center().x(),
                self.parent().center().y()-self.center().y(),
                self.parent().center().z()-self.center().z()
            );

            points[0] = new Point(c.x()-half, c.y()-half, c.z()+half, self.parent().center());
            points[1] = new Point(c.x()-half, c.y()+half, c.z()+half, self.parent().center());
            points[2] = new Point(c.x()+half, c.y()-half, c.z()+half, self.parent().center());
            points[3] = new Point(c.x()+half, c.y()+half, c.z()+half, self.parent().center());

            points[4] = new Point(c.x()-half, c.y()-half, c.z()-half, self.parent().center());
            points[5] = new Point(c.x()-half, c.y()+half, c.z()-half, self.parent().center());
            points[6] = new Point(c.x()+half, c.y()-half, c.z()-half, self.parent().center());
            points[7] = new Point(c.x()+half, c.y()+half, c.z()-half, self.parent().center());

            lines[0] = new Line(points[0], points[1], self.color(), self.parent());
            lines[1] = new Line(points[1], points[3], self.color(), self.parent());
            lines[2] = new Line(points[2], points[0], self.color(), self.parent());
            lines[3] = new Line(points[3], points[2], self.color(), self.parent());

            lines[4] = new Line(points[4], points[5], self.color(), self.parent());
            lines[5] = new Line(points[5], points[7], self.color(), self.parent());
            lines[6] = new Line(points[6], points[4], self.color(), self.parent());
            lines[7] = new Line(points[7], points[6], self.color(), self.parent());

            lines[8] = new Line(points[0], points[4], self.color(), self.parent());
            lines[9] = new Line(points[1], points[5], self.color(), self.parent());
            lines[10] = new Line(points[2], points[6], self.color(), self.parent());
            lines[11] = new Line(points[3], points[7], self.color(), self.parent());

            createGraphics();

            self.parent().addGraphics(self.graphics());
            self.render();
        };

        var createGraphics = function() {
            self.setGraphics(document.createElementNS(XMLNS, "g"));
            for(var i=0; i<lines.length; i++) {
                self.graphics().appendChild(lines[i].graphics());
            }
        };

        self.getPoints = function() {
            return points;
        };

        self.rotate = function(R) {
            for(var i=0; i<points.length; i++) {
                points[i].rotate(R);
            }
        };

        self.render = function() {
            for(var i=0; i<lines.length; i++) {
                lines[i].render();
            }
        };

        init();
    };

    function Line(_point1, _point2, _color, _parent) {
        Primitive.call(this, _color, _parent);
        var self = this;
        var point1 = _point1;
        var point2 = _point2;

        var init = function() {
            self.setGraphics(document.createElementNS(XMLNS, "line"));
            self.graphics().setAttribute("stroke", self.color());
        };

        var setPosition = function() {
            self.graphics().setAttribute("x1", point1.px());
            self.graphics().setAttribute("y1", point1.py());
            self.graphics().setAttribute("x2", point2.px());
            self.graphics().setAttribute("y2", point2.py());
        };

        self.render = function() {
            setPosition();
        };

        init();
    };

    function Point(_x, _y, _z, _origin) {
        var self = this;
        var origin = _origin;

        var xyz = [_x, _y, _z];
        var xyz_tmp = [0, 0, 0];
        var projection = [0, 0];

        var init = function() {
            self.project();
        };

        self.project = function() {
            for(var i=0; i<S.length; i++) {
                projection[i] = 0;
                for(var j=0; j<S[i].length; j++) {
                    projection[i] += S[i][j]*xyz[j];
                }
            }
        };

        self.rotate = function(R) {
            xyz[0] -= origin.x();
            xyz[1] -= origin.y();
            xyz[2] -= origin.z();
            xyz_tmp[0] = xyz.dot(R[0]);
            xyz_tmp[1] = xyz.dot(R[1]);
            xyz_tmp[2] = xyz.dot(R[2]);
            xyz[0] = xyz_tmp[0] + origin.x();
            xyz[1] = xyz_tmp[1] + origin.y();
            xyz[2] = xyz_tmp[2] + origin.z();
            self.project();
        };

        self.x = function() { return xyz[0]; };
        self.y = function() { return xyz[1]; };
        self.z = function() { return xyz[2]; };

        self.px = function() { return projection[0]; };
        self.py = function() { return projection[1]; };

        init();
    };
}

Array.prototype.is2darray = function() {
    return this.length > 0 && this[0] instanceof Array;
};

Array.prototype.dot = function(a, s) {
    if(this.is2darray() && a.is2darray()) {
        return this.mdot(a);
    }
    return this.adot(a);
};

Array.prototype.adot = function(a) {
    if(!(a instanceof Array)) {
        throw "Not an array.";
    }
    if(this.length != a.length) {
        throw "Arrays not of same length.";
    }
    var s = 0;
    for(var i=0; i<this.length; i++) {
        s += this[i]*a[i];
    }
    return s;
};

Array.prototype.mdot = function(a) {
    if(this[0].length != a.length) {
        throw "Non-conforming arrays.";
    }
    var rows = this.length;
    var columns = a[0].length;
    var s = new Array(rows);
    for(var row=0; row<rows; row++) {
        s[row] = new Array(columns);
        for(var col=0; col<columns; col++) {
            s[row][col] = 0;
            for(var i=0; i<this[row].length; i++) {
                s[row][col] += this[row][i]*a[i][col];
            }
        }
    }
    return s;
};