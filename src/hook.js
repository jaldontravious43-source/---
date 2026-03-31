export class Hook {
  constructor(anchor, options = {}) {
    this.anchor = anchor;
    this.state = "idle";
    this.angle = options.minAngle ?? -0.85;
    this.minAngle = options.minAngle ?? -0.85;
    this.maxAngle = options.maxAngle ?? 0.85;
    this.swingSpeed = options.swingSpeed ?? 1.9;
    this.length = 0;
    this.maxLength = options.maxLength ?? 430;
    this.extendSpeed = options.extendSpeed ?? 720;
    this.retractSpeed = options.retractSpeed ?? 840;
    this.swingDirection = 1;
    this.caughtItem = null;
    this.tipRadius = 12;
  }

  get isBusy() {
    return this.state !== "idle";
  }

  fire() {
    if (this.state !== "idle") {
      return false;
    }

    this.state = "extending";
    return true;
  }

  attachItem(item) {
    this.caughtItem = item;
    this.state = "retracting";
  }

  getTipPosition() {
    const offsetX = Math.sin(this.angle) * this.length;
    const offsetY = Math.cos(this.angle) * this.length;
    return { x: this.anchor.x + offsetX, y: this.anchor.y + offsetY };
  }

  update(deltaTime, bounds) {
    if (this.state === "idle") {
      this.angle += this.swingSpeed * this.swingDirection * deltaTime;
      if (this.angle >= this.maxAngle) {
        this.angle = this.maxAngle;
        this.swingDirection = -1;
      } else if (this.angle <= this.minAngle) {
        this.angle = this.minAngle;
        this.swingDirection = 1;
      }
      return { deliveredItem: null };
    }

    if (this.state === "extending") {
      this.length += this.extendSpeed * deltaTime;
      const tip = this.getTipPosition();
      const outOfBounds = tip.y > bounds.height - 10 || tip.x < 8 || tip.x > bounds.width - 8;
      if (this.length >= this.maxLength || outOfBounds) {
        this.state = "retracting";
      }
      return { deliveredItem: null };
    }

    const retractSpeed = this.caughtItem?.pullSpeed ?? this.retractSpeed;
    this.length = Math.max(0, this.length - retractSpeed * deltaTime);
    if (this.length <= 0) {
      const deliveredItem = this.caughtItem;
      this.caughtItem = null;
      this.state = "idle";
      return { deliveredItem };
    }
    return { deliveredItem: null };
  }
}
