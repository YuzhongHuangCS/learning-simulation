/**
 * @author Eberhard Graether / http://egraether.com/
 */

THREE.TrackballControls = function ( object, domElement ) {

	THREE.EventTarget.call( this );

	var _this = this;
	var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.screen = { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 };
	this.radius = ( this.screen.width + this.screen.height ) / 4;

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.noRotate = false;
	this.noZoom = false;
	this.noPan = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;

	this.keys = [ 65 /*A*/, 83 /*S*/, 68 /*D*/ ];

	// internals

	this.target = new THREE.Vector3();

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,

	_eye = new THREE.Vector3(),

	_rotateStart = new THREE.Vector3(),
	_rotateEnd = new THREE.Vector3(),

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_panStart = new THREE.Vector2(),
	_panEnd = new THREE.Vector2();

	// events

	var changeEvent = { type: 'change' };


	// methods

	this.handleResize = function () {

		this.screen.width = window.innerWidth;
		this.screen.height = window.innerHeight;

		this.screen.offsetLeft = 0;
		this.screen.offsetTop = 0;

		this.radius = ( this.screen.width + this.screen.height ) / 4;
	};

	this.handleEvent = function ( event ) {

		if ( typeof this[ event.type ] == 'function' ) {

			this[ event.type ]( event );

		}

	};

	this.getMouseOnScreen = function ( clientX, clientY ) {

		return new THREE.Vector2(
			( clientX - _this.screen.offsetLeft ) / _this.radius * 0.5,
			( clientY - _this.screen.offsetTop ) / _this.radius * 0.5
		);

	};

	this.getMouseProjectionOnBall = function ( clientX, clientY ) {

		var mouseOnBall = new THREE.Vector3(
			( clientX - _this.screen.width * 0.5 - _this.screen.offsetLeft ) / _this.radius,
			( _this.screen.height * 0.5 + _this.screen.offsetTop - clientY ) / _this.radius,
			0.0
		);

		var length = mouseOnBall.length();

		if ( length > 1.0 ) {

			mouseOnBall.normalize();

		} else {

			mouseOnBall.z = Math.sqrt( 1.0 - length * length );

		}

		_eye.copy( _this.object.position ).subSelf( _this.target );

		var projection = _this.object.up.clone().setLength( mouseOnBall.y );
		projection.addSelf( _this.object.up.clone().crossSelf( _eye ).setLength( mouseOnBall.x ) );
		projection.addSelf( _eye.setLength( mouseOnBall.z ) );

		return projection;

	};

	this.rotateCamera = function () {

		var angle = Math.acos( _rotateStart.dot( _rotateEnd ) / _rotateStart.length() / _rotateEnd.length() );

		if ( angle ) {

			var axis = ( new THREE.Vector3() ).cross( _rotateStart, _rotateEnd ).normalize(),
				quaternion = new THREE.Quaternion();

			angle *= _this.rotateSpeed;

			quaternion.setFromAxisAngle( axis, -angle );

			quaternion.multiplyVector3( _eye );
			quaternion.multiplyVector3( _this.object.up );

			quaternion.multiplyVector3( _rotateEnd );

			if ( _this.staticMoving ) {

				_rotateStart.copy( _rotateEnd );

			} else {

				quaternion.setFromAxisAngle( axis, angle * ( _this.dynamicDampingFactor - 1.0 ) );
				quaternion.multiplyVector3( _rotateStart );

			}

		}

	};

	this.zoomCamera = function () {

		var factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

		if ( factor !== 1.0 && factor > 0.0 ) {

			_eye.multiplyScalar( factor );

			if ( _this.staticMoving ) {

				_zoomStart.copy( _zoomEnd );

			} else {

				_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

			}

		}

	};

	this.panCamera = function () {

		var mouseChange = _panEnd.clone().subSelf( _panStart );

		if ( mouseChange.lengthSq() ) {

			mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

			var pan = _eye.clone().crossSelf( _this.object.up ).setLength( mouseChange.x );
			pan.addSelf( _this.object.up.clone().setLength( mouseChange.y ) );

			_this.object.position.addSelf( pan );
			_this.target.addSelf( pan );

			if ( _this.staticMoving ) {

				_panStart = _panEnd;

			} else {

				_panStart.addSelf( mouseChange.sub( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

			}

		}

	};

	this.checkDistances = function () {

		if ( !_this.noZoom || !_this.noPan ) {

			if ( _this.object.position.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.setLength( _this.maxDistance );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.add( _this.target, _eye.setLength( _this.minDistance ) );

			}

		}

	};

	this.update = function () {

		_eye.copy( _this.object.position ).subSelf( _this.target );

		if ( !_this.noRotate ) {

			_this.rotateCamera();

		}

		if ( !_this.noZoom ) {

			_this.zoomCamera();

		}

		if ( !_this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.add( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if ( lastPosition.distanceToSquared( _this.object.position ) > 0 ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};

	// listeners

	function keydown( event ) {

		if ( ! _this.enabled ) return;

		window.removeEventListener( 'keydown', keydown );

		_prevState = _state;

		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ STATE.ROTATE ] && !_this.noRotate ) {

			_state = STATE.ROTATE;

		} else if ( event.keyCode === _this.keys[ STATE.ZOOM ] && !_this.noZoom ) {

			_state = STATE.ZOOM;

		} else if ( event.keyCode === _this.keys[ STATE.PAN ] && !_this.noPan ) {

			_state = STATE.PAN;

		}

	}

	function keyup( event ) {

		if ( ! _this.enabled ) return;

		_state = _prevState;

		window.addEventListener( 'keydown', keydown, false );

	}

	function mousedown( event ) {

		if ( ! _this.enabled ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.NONE ) {

			_state = event.button;

		}

		if ( _state === STATE.ROTATE && !_this.noRotate ) {

			_rotateStart = _rotateEnd = _this.getMouseProjectionOnBall( event.clientX, event.clientY );

		} else if ( _state === STATE.ZOOM && !_this.noZoom ) {

			_zoomStart = _zoomEnd = _this.getMouseOnScreen( event.clientX, event.clientY );

		} else if ( _state === STATE.PAN && !_this.noPan ) {

			_panStart = _panEnd = _this.getMouseOnScreen( event.clientX, event.clientY );

		}

		document.addEventListener( 'mousemove', mousemove, false );
		document.addEventListener( 'mouseup', mouseup, false );

	}

	function mousemove( event ) {

		if ( ! _this.enabled ) return;

		if ( _state === STATE.ROTATE && !_this.noRotate ) {

			_rotateEnd = _this.getMouseProjectionOnBall( event.clientX, event.clientY );

		} else if ( _state === STATE.ZOOM && !_this.noZoom ) {

			_zoomEnd = _this.getMouseOnScreen( event.clientX, event.clientY );

		} else if ( _state === STATE.PAN && !_this.noPan ) {

			_panEnd = _this.getMouseOnScreen( event.clientX, event.clientY );

		}

	}

	function mouseup( event ) {

		if ( ! _this.enabled ) return;

		event.preventDefault();
		event.stopPropagation();

		_state = STATE.NONE;

		document.removeEventListener( 'mousemove', mousemove );
		document.removeEventListener( 'mouseup', mouseup );

	}

	function mousewheel( event ) {

		if ( ! _this.enabled ) return;

		event.preventDefault();
		event.stopPropagation();

		var delta = 0;

		if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

			delta = event.wheelDelta / 40;

		} else if ( event.detail ) { // Firefox

			delta = - event.detail / 3;

		}

		_zoomStart.y += ( 1 / delta ) * 0.05;

	}

	function touchstart( event ) {

		if ( ! _this.enabled ) return;

		event.preventDefault();

		switch ( event.touches.length ) {

			case 1:
				_rotateStart = _rotateEnd = _this.getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;
			case 2:
				_zoomStart = _zoomEnd = _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;
			case 3:
				_panStart = _panEnd = _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;

		}

	}

	function touchmove( event ) {

		if ( ! _this.enabled ) return;

		event.preventDefault();

		switch ( event.touches.length ) {

			case 1:
				_rotateEnd = _this.getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;
			case 2:
				_zoomEnd = _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;
			case 3:
				_panEnd = _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;

		}

	}

	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );

	this.domElement.addEventListener( 'mousedown', mousedown, false );

	this.domElement.addEventListener( 'mousewheel', mousewheel, false );
	this.domElement.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchstart, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );

	this.handleResize();

};

// Make sure WebGL is supported and enabled
if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
}

var camera, scene, renderer, controls, clock, container, stats; // Scene and drawing
var sphereGeo, boxGeo, grid; // Geometry
var sphereMaterial, boxMaterial; // Materials
var sphereMesh, boxMesh, wireMesh, gridMeshLines = [],
solidPlane; // The meshes
var Parameters = {
	"gravity": -9.8,
	"start velocity x": -3.0,
	"start velocity y": 0.0,
	"start velocity z": 0.0,
	mass: 90,
	friction: 0.0,
	restitution: 1.0,
	drag: 0.23,
	"sphere color": 0xCC0000,
	"box color": 0x00CC00,
	"box border color": 0xff0000,
	"grid color": 0x444444,
	"shadows": false,
	Impulse: function() {
		vV.addSelf(new THREE.Vector3(10 - Math.random() * 20, 10 - Math.random() * 20, 10 - Math.random() * 20));
	},
	Restart: function() {
		setSimulation();
	},
	Reload: function() {
		window.location.reload();
	}
};

var timeStep, xV, vV, aV, gravity = new THREE.Vector3(0.0, -9.8, 0.0); // Physics state
var mass, restitution, friction, drag, startVelocity; // Start parameters
var epsilonX = 0.001,
epsilonV = 0.001,
epsilonA = 0.001;
var planes = [{
	normal: new THREE.Vector3(0.0, 1.0, 0.0),
	point: new THREE.Vector3(0.0, 0.0, 0.0),
	resting: false
},
// Bottom
{
	normal: new THREE.Vector3(0.0, -1.0, 0.0),
	point: new THREE.Vector3(0.0, 12.0, 0.0),
	resting: false
},
// Top
{
	normal: new THREE.Vector3( - 1.0, 0.0, 0.0),
	point: new THREE.Vector3(6.0, 0.0, 0.0),
	resting: false
},
// Left
{
	normal: new THREE.Vector3(1.0, 0.0, 0.0),
	point: new THREE.Vector3( - 6.0, 0.0, 0.0),
	resting: false
},
// Right
{
	normal: new THREE.Vector3(0.0, 0.0, -1.0),
	point: new THREE.Vector3(0.0, 0.0, 6.0),
	resting: false
},
// Front 
{
	normal: new THREE.Vector3(0.0, 0.0, 1.0),
	point: new THREE.Vector3(0.0, 0.0, -6.0),
	resting: false
},
// Back
];

init();
setSimulation();
animate();

function init() {

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
	camera.position.x = 0;
	camera.position.y = 20;
	camera.position.z = 28;
	camera.lookAt(new THREE.Vector3(0, 0, 0));

	scene = new THREE.Scene();

	makeCubeWithOutline();
	makeSphere();
	makeGrid();
	makeSolidPlane();

	// Timing
	clock = new THREE.Clock();

	// Stats
	container = document.createElement('div');
	document.body.appendChild(container);
	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild(stats.domElement);

	// Create a point light
	var pointLight = new THREE.PointLight(0xFFFFFF);
	pointLight.position.x = 10;
	pointLight.position.y = 50;
	pointLight.position.z = 130;
	scene.add(pointLight);

	var light2 = new THREE.SpotLight(0xffffff, 2.5);
	light2.position.set( - 14, 14, -17);
	light2.target.position.set(0, 0, 0);

	light2.castShadow = true;

	light2.shadowCameraNear = 0.1;
	light2.shadowCameraFar = camera.far;
	light2.shadowCameraFov = 60;

	light2.shadowBias = 0.0000022;
	light2.shadowDarkness = 0.5;

	light2.shadowMapWidth = 2048;
	light2.shadowMapHeight = 2048;
	//light2.shadowCameraVisible = true;
	scene.add(light2);

	// Instantiate the renderer
	renderer = new THREE.WebGLRenderer();
	renderer.shadowMapEnabled = true;
	renderer.shadowMapSoft = true;
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.sortObjects = false;

	// Create controls tp view scene
	controls = new THREE.TrackballControls(camera, renderer.domElement);
	controls.rotateSpeed = 1.0;
	controls.zoomSpeed = 1.2;
	controls.panSpeed = 0.2;

	controls.noZoom = false;
	controls.noPan = false;

	controls.staticMoving = false;
	controls.dynamicDampingFactor = 0.3;

	controls.minDistance = 1.1;
	controls.maxDistance = 100;

	controls.keys = [65, 83, 68]; // [ rotateKey, zoomKey, panKey ]
	// GUI controls
	//var text = new Parameters();
	var gui = new dat.GUI({
		height: 5 * 32 - 1
	});
	var f1 = gui.addFolder('Start Parameters');
	f1.add(Parameters, "gravity", {
		Half: -4.9,
		Regular: -9.8,
		Double: -19.6
	});
	f1.add(Parameters, "start velocity x", -10.0, 10.0);
	f1.add(Parameters, "start velocity y", -10.0, 10.0);
	f1.add(Parameters, "start velocity z", -10.0, 10.0);
	f1.add(Parameters, 'mass', {
		Light: 40,
		Medium: 90,
		Heavy: 200
	});
	f1.add(Parameters, 'friction', 0.0, 1.0);
	f1.add(Parameters, 'restitution', 0.0, 1.0);
	f1.add(Parameters, 'drag', 0.0, 1.0);
	f1.open();
	var f2 = gui.addFolder('Visual');
	f2.addColor(Parameters, "sphere color").onChange(function(value) {
		sphereMesh.material = new THREE.MeshPhongMaterial({
			color: value
		});
	});
	f2.addColor(Parameters, "box color").onChange(function(value) {
		boxMesh.material = new THREE.MeshPhongMaterial({
			blending: THREE.AdditiveBlending,
			transparent: true,
			opacity: 0.5,
			color: value
		});
	});
	f2.addColor(Parameters, "box border color").onChange(function(value) {
		wireMesh.material = new THREE.MeshBasicMaterial({
			color: value,
			wireframe: true
		});
	});
	f2.addColor(Parameters, "grid color").onChange(function(value) {
		var gridMaterial = new THREE.LineBasicMaterial({
			color: value,
		});
		var gridMidMat = new THREE.LineBasicMaterial({
			color: value,
			linewidth: 2
		});
		for (var i = 0; i < gridMeshLines.length; i++) {
			gridMeshLines[i].material = gridMaterial;
			if (i == 12 || i == 37) {
				gridMeshLines[i].material = gridMidMat;
			}
		}

		// Change the color of the solid plane
		solidPlane.material = new THREE.MeshBasicMaterial({
			color: value
		});
	});
	f2.add(Parameters, "shadows").onChange(function(value) {
		if (value) {
			// Add plane 
			scene.add(solidPlane);
			// remove lines from scene
			for (var i = 0; i < gridMeshLines.length; i++) {
				scene.remove(gridMeshLines[i]);
			}
			// remove box and wire box meshes
			scene.remove(boxMesh);
			scene.remove(wireMesh);
			// set dramatic clear color
			renderer.setClearColorHex(0x000000, 1);
		} else {
			// remove plane 
			scene.remove(solidPlane);
			// add lines from scene
			for (var i = 0; i < gridMeshLines.length; i++) {
				scene.add(gridMeshLines[i]);
			}
			// add box and wire box meshes
			scene.add(wireMesh);
			scene.add(boxMesh);
			// reset clear color
			renderer.setClearColorHex(0xFFFFFF, 1);

		}
	});;
	f2.open();
	gui.add(Parameters, 'Impulse');
	gui.add(Parameters, 'Restart');
	gui.add(Parameters, 'Reload');
	// Set / create the drawing surface dom element
	document.body.appendChild(renderer.domElement);
}

function makeSphere() {
	// Material for sphere
	sphereMaterial = new THREE.MeshPhongMaterial({
		color: 0xCC0000
	});

	// Create geometry for sphere
	var radius = 1.5,
	segments = 16,
	rings = 16;
	sphereGeo = new THREE.SphereGeometry(radius, segments, rings);

	// Create sphere mesh
	sphereMesh = new THREE.Mesh(sphereGeo, sphereMaterial);

	// Set initial positions
	sphereMesh.position.set(0.0, 6.0, 0.0);
	sphereMesh.castShadow = true;
	// Add to scene		
	scene.add(sphereMesh);
}

function makeCubeWithOutline() {
	// Material for box
	boxMaterial = new THREE.MeshPhongMaterial({
		blending: THREE.AdditiveBlending,
		transparent: true,
		opacity: 0.5,
		color: 0x00CC00
	});
	var wireBoxMaterial = new THREE.MeshBasicMaterial({
		color: 0xff0000,
		wireframe: true
	});

	// Create box geometry. (x, y, z) size in directions
	boxGeo = new THREE.CubeGeometry(12, 12, 12);
	// create wire frame geometry outline for box
	var wireBoxGeometry = new THREE.CubeGeometry(12, 12, 12);

	// Create box mesh
	boxMesh = new THREE.Mesh(boxGeo, boxMaterial);
	// Create wireframe mesh 
	wireMesh = new THREE.Mesh(wireBoxGeometry, wireBoxMaterial);

	// Set initial positions
	boxMesh.position.set(0, 6.01, 0);
	wireMesh.position.set(0, 6.01, 0);

	// add to scene
	scene.add(boxMesh);
	scene.add(wireMesh);
}

function makeGrid() {
	// Create grid material
	var gridMaterial = new THREE.LineBasicMaterial({
		color: 0x444444,
	});
	var gridMidMat = new THREE.LineBasicMaterial({
		color: 0x444444,
		linewidth: 2
	});

	for (var x = -12; x <= 12; x++) {
		// Creat grid geometry
		var gridGeo = new THREE.Geometry();
		gridGeo.vertices.push(new THREE.Vector3(x, 0, -12));
		gridGeo.vertices.push(new THREE.Vector3(x, 0, 12));

		var line = new THREE.Line(gridGeo, gridMaterial);
		if (x == 0) {
			line = new THREE.Line(gridGeo, gridMidMat);
		}
		gridMeshLines.push(line);
		scene.add(line);
	}

	for (var z = -12; z <= 12; z++) {
		// Create grid geometry
		var gridGeo = new THREE.Geometry();
		gridGeo.vertices.push(new THREE.Vector3( - 12, 0, z));
		gridGeo.vertices.push(new THREE.Vector3(12, 0, z));

		var line = new THREE.Line(gridGeo, gridMaterial);
		if (z == 0) {
			line = new THREE.Line(gridGeo, gridMidMat);
		}
		gridMeshLines.push(line);
		scene.add(line);
	}
}

function makeSolidPlane() {
	solidPlane = new THREE.Mesh(new THREE.CubeGeometry(24, 0.1, 24), new THREE.MeshLambertMaterial({
		color: 0x666f84
	}));
	solidPlane.receiveShadow = true;
	solidPlane.position.y = 0;
}

function force(plane, gv, velocity, d) {
	var f = new THREE.Vector3().sub(gv.clone().multiplyScalar(mass), velocity.clone().multiplyScalar(d)); // mg` - dv`
	return f;
}

function collision(currPos, newPos, plane) {
	// First determine how far sphere  is from plane
	var xMinusP0 = new THREE.Vector3().sub(newPos, plane.point);
	var d = plane.normal.dot(xMinusP0) - sphereGeo.boundingSphere.radius; // Account for radius
	// if its negative or zero then we have a collision
	if (d <= 0.0) {
		return true;
	}
	return false;
}

function fractionOfTimeToCollision(currPos, newPos, plane) {
	// d = (xnew` - x`) * n`
	var posDelta = new THREE.Vector3().sub(newPos, currPos);
	var d = posDelta.dot(plane.normal) - sphereGeo.boundingSphere.radius; // Account for radius
	// h = (plane.p` - xnew`) * n`
	var dPlane = new THREE.Vector3().sub(plane.point, newPos);
	var h = dPlane.dot(plane.normal);
	return h / d;
}

function reflect(collisionVelocity, plane, rho, frict) {
	// vp` = (vc` * plane.normal`)plane.normal`
	var vp = plane.normal.clone().multiplyScalar(collisionVelocity.dot(plane.normal));
	var vt = new THREE.Vector3().sub(collisionVelocity, vp);

	vp.multiplyScalar( - 1 * rho);
	vp.addSelf(vt.multiplyScalar(1 - frict));
	return vp;
}

function isRestingOnPlane(plane, xn, v, a) {
	// Must be on the plane, as in a collision
	var posDelta = new THREE.Vector3().sub(xn, plane.point);
	var d = posDelta.dot(plane.normal) - sphereGeo.boundingSphere.radius; // Account for radius
	// no velocity normal to floor
	var vtest = Math.abs(v.dot(plane.normal));
	// no acceleration away from floor    
	var atest = Math.abs(a.dot(plane.normal));
	if (d < 0.1 && vtest < 0.1) {
		return true;
	}

	return false;
}

function doPhysicsCalculations(currentPosition, currentVelocity, currentAcc, currentForces, delta) {
	// Calculate the new velocity, position, and acceleration
	var sphereForce = force(planes[0], currentForces, currentVelocity, drag);

	var i = 0;
	while (i < 6) {
		if (planes[i].resting) {
			// Apply opposing plane force, the plane normal at magnitude of f
			sphereForce.addSelf(planes[i].normal.clone().multiplyScalar(sphereForce.length()));
		}
		i++;
	}
	var newAcc = sphereForce.multiplyScalar(1 / mass);

	var newVelocity = new THREE.Vector3();
	newVelocity.add(currentVelocity, new THREE.Vector3(delta * currentAcc.x, delta * currentAcc.y, delta * currentAcc.z));

	var newPosition = new THREE.Vector3();
	newPosition.add(currentPosition, new THREE.Vector3(delta * currentVelocity.x, delta * currentVelocity.y, delta * currentVelocity.z));

	// Detect for a collision on just bottom plane (for now)
	var planeIndex = 0;

	while (planeIndex < 6) {
		if (!planes[planeIndex].resting && collision(currentPosition, newPosition, planes[planeIndex])) {
			// Now find out where it collides, velocity at time of collision, and 
			// fraction of timeStep it took to collide to preserve frame rate and realism
			var fractionTime = fractionOfTimeToCollision(currentPosition, newPosition, planes[planeIndex]); // [0.0, 1.0]
			// vc` = v` + a`*f*deltaT
			var collisionVelocity = new THREE.Vector3().add(currentVelocity, currentAcc.clone().multiplyScalar(fractionTime * delta));
			// xc` = x` + v`*f*deltaT
			var collisionPosition = new THREE.Vector3().add(currentPosition, currentVelocity.clone().multiplyScalar(fractionTime * delta));

			// Reflect the collision velocity
			collisionVelocity = reflect(collisionVelocity, planes[planeIndex], restitution, friction);

			// Get the new velocity and position
			newVelocity.add(collisionVelocity, currentAcc.clone().multiplyScalar((1 - fractionTime) * delta));
			newPosition.add(collisionPosition, collisionVelocity.multiplyScalar((1 - fractionTime) * delta));

			sphereForce = force(planes[planeIndex], currentForces, collisionVelocity, drag);
			newAcc = sphereForce.multiplyScalar(1 / mass);
			//console.log('I is : '+planeIndex);
		}

		var resting = isRestingOnPlane(planes[planeIndex], newPosition, newVelocity, newAcc);
		planes[planeIndex].resting = resting;

		var d = (sphereForce.dot(planes[planeIndex].normal));
		if (planes[planeIndex].resting) {
			sphereForce = sphereForce.clone().subSelf(planes[planeIndex].normal.clone().multiplyScalar(d));
			newAcc = sphereForce.multiplyScalar(1 / mass);
			// We need to reset the velocity too since its supposed to be zero
			var veld = (newVelocity.dot(planes[planeIndex].normal));
			newVelocity = newVelocity.clone().subSelf(planes[planeIndex].normal.clone().multiplyScalar(veld));
		}
		planeIndex++;
	}
	return {
		currentPosition: newPosition,
		currentVelocity: newVelocity,
		currentAcc: newAcc
	};
}

function setSimulation(params) {
	timeStep = 0.0;
	aV = gravity;
	sphereMesh.position.set(0.0, 6.0, 0.0);
	xV = sphereMesh.position;

	// Parameters
	vV = startVelocity = new THREE.Vector3(Parameters["start velocity x"], Parameters["start velocity y"], Parameters["start velocity z"]);
	mass = parseInt(Parameters.mass);
	restitution = parseFloat(Parameters.restitution);
	friction = parseFloat(Parameters.friction);
	drag = parseFloat(Parameters.drag);
}

function animate() {
	requestAnimationFrame(animate); // pure wizard magic
	// Calculate physics for timestep for the sphere, give it a position, velocity, acceleration, forces acting on it and time.
	var delta = clock.getDelta(); // Critical for frame rate timing
	var returnState = doPhysicsCalculations(xV.clone(), vV.clone(), aV.clone(), gravity.clone(), delta);
	// Update state for the next time around
	xV = returnState.currentPosition;
	vV = returnState.currentVelocity;
	aV = returnState.currentAcc;
	// Update the mesh
	sphereMesh.position.x = xV.x;
	sphereMesh.position.y = xV.y;
	sphereMesh.position.z = xV.z;
	timeStep += delta;

	// Now render the new scene
	controls.update();
	renderer.render(scene, camera);
	stats.update();
}
