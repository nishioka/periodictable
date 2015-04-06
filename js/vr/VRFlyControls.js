/* global THREE:false, PositionSensorVRDevice:false */

/**
 * @author James Baicoianu / http://www.baicoianu.com/
 */

THREE.VRFlyControls = function(object, domElement, callback) {

    this.object = object;

    this.domElement = (domElement !== undefined) ? domElement : document;
    if (domElement) this.domElement.setAttribute('tabindex', -1);

    this.plane = new THREE.Object3D();

    // game controller stuff
    this.haveEvents = 'ongamepadconnected' in window;
    this.controllers = {};

    if (!this.haveEvents) {
        setInterval(this.scangamepads, 500);
    }

    var vrInput;
    var onVRDevices = function(devices) {
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];

            if (device instanceof PositionSensorVRDevice) {
                vrInput = devices[i];
                return; // We keep the first we encounter
            }
        }

        if (callback !== undefined) {
            callback('HMD not available');
        }
    };

    if (navigator.getVRDevices !== undefined) {
        navigator.getVRDevices().then(onVRDevices);
    } else if (callback !== undefined) {
        callback('Your browser is not VR Ready');
    }

    // API
    this.movementSpeed = 1.0;
    this.rollSpeed = 0.002;

    this.dragToLook = false;
    this.autoForward = false;

    // disable default target object behavior

    // internals
    this.tmpQuaternion = new THREE.Quaternion();
    this.vrQuaternion = new THREE.Quaternion();

    this.mouseStatus = 0;

    this.moveState = {
        up: 0,
        down: 0,
        left: 0,
        right: 0,
        forward: 0,
        back: 0,
        pitchUp: 0,
        pitchDown: 0,
        yawLeft: 0,
        yawRight: 0,
        rollLeft: 0,
        rollRight: 0
    };
    this.moveVector = new THREE.Vector3(0, 0, 0);
    this.rotationVector = new THREE.Vector3(0, 0, 0);

    this.handleEvent = function(event) {
        if (typeof this[event.type] === 'function') {
            this[event.type](event);
        }
    };

    this.keydown = function(event) {
        if (event.altKey) {
            return;
        }

        //event.preventDefault();

        switch (event.keyCode) {
            case 16:
                /* shift */
                this.movementSpeedMultiplier = 0.1;
                break;

            case 87:
                /*W*/
                this.moveState.forward = 1;
                break;
            case 83:
                /*S*/
                this.moveState.back = 1;
                break;

            case 65:
                /*A*/
                this.moveState.left = 1;
                break;
            case 68:
                /*D*/
                this.moveState.right = 1;
                break;

            case 82:
                /*R*/
                this.moveState.up = 1;
                break;
            case 70:
                /*F*/
                this.moveState.down = 1;
                break;

            case 38:
                /*up*/
                this.moveState.pitchUp = 1;
                break;
            case 40:
                /*down*/
                this.moveState.pitchDown = 1;
                break;

            case 37:
                /*left*/
                this.moveState.yawLeft = 1;
                break;
            case 39:
                /*right*/
                this.moveState.yawRight = 1;
                break;

            case 81:
                /*Q*/
                this.moveState.rollLeft = 1;
                break;
            case 69:
                /*E*/
                this.moveState.rollRight = 1;
                break;
        }

        this.updateMovementVector();
        this.updateRotationVector();
    };

    this.keyup = function(event) {
        switch (event.keyCode) {

            case 16:
                /* shift */
                this.movementSpeedMultiplier = 1;
                break;

            case 87:
                /*W*/
                this.moveState.forward = 0;
                break;
            case 83:
                /*S*/
                this.moveState.back = 0;
                break;

            case 65:
                /*A*/
                this.moveState.left = 0;
                break;
            case 68:
                /*D*/
                this.moveState.right = 0;
                break;

            case 82:
                /*R*/
                this.moveState.up = 0;
                break;
            case 70:
                /*F*/
                this.moveState.down = 0;
                break;

            case 38:
                /*up*/
                this.moveState.pitchUp = 0;
                break;
            case 40:
                /*down*/
                this.moveState.pitchDown = 0;
                break;

            case 37:
                /*left*/
                this.moveState.yawLeft = 0;
                break;
            case 39:
                /*right*/
                this.moveState.yawRight = 0;
                break;

            case 81:
                /*Q*/
                this.moveState.rollLeft = 0;
                break;
            case 69:
                /*E*/
                this.moveState.rollRight = 0;
                break;
        }
        this.updateMovementVector();
        this.updateRotationVector();
    };

    this.update = function(delta) {
        var moveMult = delta * this.movementSpeed;
        var rotMult = delta * this.rollSpeed;

        // game controller
        for (var j in this.controllers) {
            var controller = this.controllers[j];
            /*
            for (var i = 0; i < controller.buttons.length; i++) {
                var val = controller.buttons[i];
                var pressed = val === 1.0;
                if (typeof(val) === 'object') {
                    pressed = val.pressed;
                    val = val.value;
                }
                if (pressed) {
                    console.log('button(' + i + ') pressed');
                }
            }
            */
            if (controller.axes[1] > 0.5 || controller.axes[1] < -0.5) {
                this.moveVector.z = controller.axes[1]; // forward
            }
            if (controller.axes[0] > 0.5 || controller.axes[0] < -0.5) {
                this.rotationVector.y = -controller.axes[0]; // yaw
            }
            if (controller.axes[2] > 0.5 || controller.axes[2] < -0.5) {
                this.rotationVector.z = -controller.axes[2]; // roll
            }
            if (controller.axes[3] > 0.5 || controller.axes[3] < -0.5) {
                this.rotationVector.x = controller.axes[3]; // pitch
            }
        }

        this.plane.translateX(this.moveVector.x * moveMult);
        this.plane.translateY(this.moveVector.y * moveMult);
        this.plane.translateZ(this.moveVector.z * moveMult);

        this.tmpQuaternion.set(
            this.rotationVector.x * rotMult,
            this.rotationVector.y * rotMult,
            this.rotationVector.z * rotMult,
            1
        ).normalize();
        this.plane.quaternion.multiply(this.tmpQuaternion);

        // expose the rotation vector for convenience
        this.plane.rotation.setFromQuaternion(this.plane.quaternion, this.plane.rotation.order);

        this.object.position.copy(this.plane.position);

        var state = vrInput.getState();

        if (state.orientation !== null) {
            this.vrQuaternion.set(
                state.orientation.x,
                state.orientation.y,
                state.orientation.z,
                state.orientation.w).normalize();
        }
        this.tmpQuaternion.copy(this.plane.quaternion);
        this.object.rotation.setFromQuaternion(this.tmpQuaternion.multiply(this.vrQuaternion));

        this.rotationVector.set (0, 0, 0);
        this.moveVector.set (0, 0, 0);
    };

    this.updateMovementVector = function() {
        var forward = (this.moveState.forward || (this.autoForward && !this.moveState.back)) ? 1 : 0;

        this.moveVector.x = (-this.moveState.left + this.moveState.right);
        this.moveVector.y = (-this.moveState.down + this.moveState.up);
        this.moveVector.z = (-forward + this.moveState.back);

        //console.log( 'move:', [ this.moveVector.x, this.moveVector.y, this.moveVector.z ] );
    };

    this.updateRotationVector = function() {
        this.rotationVector.x = (-this.moveState.pitchDown + this.moveState.pitchUp);
        this.rotationVector.y = (-this.moveState.yawRight + this.moveState.yawLeft);
        this.rotationVector.z = (-this.moveState.rollRight + this.moveState.rollLeft);

        //console.log( 'rotate:', [ this.rotationVector.x, this.rotationVector.y, this.rotationVector.z ] );
    };

    this.getContainerDimensions = function() {
        if (this.domElement !== document) {
            return {
                size: [this.domElement.offsetWidth, this.domElement.offsetHeight],
                offset: [this.domElement.offsetLeft, this.domElement.offsetTop]
            };
        } else {
            return {
                size: [window.innerWidth, window.innerHeight],
                offset: [0, 0]
            };
        }
    };

    this.connecthandler = function(e) {
        this.addgamepad(e.gamepad);
    };

    this.addgamepad = function(gamepad) {
        this.controllers[gamepad.index] = gamepad;
        console.log('addgamepad: ', this.controllers);
    };

    this.disconnecthandler = function(e) {
        this.removegamepad(e.gamepad);
    };

    this.removegamepad = function(gamepad) {
        delete this.controllers[gamepad.index];
    };

    this.scangamepads = function() {
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (var i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                if (gamepads[i].index in this.controllers) {
                    this.controllers[gamepads[i].index] = gamepads[i];
                    console.log('controllers: ', this.controllers);
                } else {
                    this.addgamepad(gamepads[i]);
                }
            }
        }
    };

    function bind(scope, fn) {
        return function() {
            fn.apply(scope, arguments);
        };
    }

    this.domElement.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    }, false);

    window.addEventListener('keydown', bind(this, this.keydown), false);
    window.addEventListener('keyup', bind(this, this.keyup), false);
    window.addEventListener("gamepadconnected", bind(this, this.connecthandler), false);
    window.addEventListener("gamepaddisconnected", bind(this, this.disconnecthandler), false);

    this.updateMovementVector();
    this.updateRotationVector();
};
