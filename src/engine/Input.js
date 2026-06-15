export class Input {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false };
    this.locked = false;

    this.onKeyDown = (e) => {
      this.keys[e.code] = true;
    };
    this.onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this.onMouseMove = (e) => {
      if (this.locked) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    };
    this.onMouseDown = () => {
      this.mouse.down = true;
    };
    this.onMouseUp = () => {
      this.mouse.down = false;
    };
    this.onPointerLockChange = () => {
      this.locked = document.pointerLockElement != null;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  isDown(code) {
    return !!this.keys[code];
  }

  consumeMouseDelta() {
    const dx = this.mouse.dx;
    const dy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }

  requestPointerLock(element) {
    element.requestPointerLock();
  }

  exitPointerLock() {
    document.exitPointerLock();
  }
}
