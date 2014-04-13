/**
 * Creates a new PerlinBox.
 *
 * @param {Object} [opt_options=] A map of initial properties.
 * @constructor
 */
function PerlinBox(opt_options) {

  var options = opt_options || {};
  options.name = 'PerlinBox';
  BitShadowMachine.Item.call(this, options);
}
BitShadowMachine.Utils.extend(PerlinBox, BitShadowMachine.Item);

/**
 * Initializes the Box.
 * @param {Object} options Initial options.
 */
PerlinBox.prototype.init = function(options) {
  this.width = options.width || 20;
  this.height = options.height || 20;
  this.color = options.color || [100, 100, 100];
  this.borderRadius = options.borderRadius || 0;

  this.acceleration = options.acceleration || new BitShadowMachine.Vector();
  this.velocity = options.velocity || new BitShadowMachine.Vector();
  this.location = options.location || new BitShadowMachine.Vector(this.world.width / 2, this.world.height / 2);
  this.mass = options.mass || 10;
  this._force = new BitShadowMachine.Vector();
  this._friction = new BitShadowMachine.Vector();

  this.maxSpeed = typeof options.maxSpeed === 'undefined' ? 10 : options.maxSpeed;
  this.minSpeed = options.minSpeed || 0;
  this.bounciness = options.bounciness || 1;

  this.checkWorldEdges = typeof options.checkWorldEdges === 'undefined' ? true : options.checkWorldEdges;
  this.life = options.life || 0;
  this.lifespan = typeof options.lifespan === 'undefined' ? -1 : options.lifespan;
};


/**
 * Updates properties.
 */
PerlinBox.prototype.step = function() {

  var repellers = BitShadowMachine.System._caches.Repeller;

  if (this.beforeStep) {
    this.beforeStep.call(this);
  }

  if (!this.isStatic) {
    if (this.world.c) { // friction
      this._friction.x = this.velocity.x;
      this._friction.y = this.velocity.y;
      this._friction.mult(-1);
      this._friction.normalize();
      this._friction.mult(this.world.c);
      this.applyForce(this._friction);
    }
    if (repellers && repellers.list.length > 0) { // repeller
      for (i = 0, max = repellers.list.length; i < max; i += 1) {
        if (this.id !== repellers.list[i].id) {
          this.applyForce(this.attract(repellers.list[i]));
        }
      }
    }
    this.applyForce(this.world.gravity);
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed, this.minSpeed);
    this.location.add(this.velocity);
    if (this.checkWorldEdges) {
      this._checkWorldEdges();
    }
    this.acceleration.mult(0);
    if (this.life < this.lifespan) {
      this.life++;
    } else if (this.lifespan !== -1) {
      BitShadowMachine.System.destroyItem(this);
    }
  }
};

/**
 * Adds a force to this object's acceleration.
 *
 * @param {Object} force A Vector representing a force to apply.
 * @returns {Object} A Vector representing a new acceleration.
 */
PerlinBox.prototype.applyForce = function(force) {
  // calculated via F = m * a
  if (force) {
    this._force.x = force.x;
    this._force.y = force.y;
    this._force.div(this.mass);
    this.acceleration.add(this._force);
    return this.acceleration;
  }
};

/**
 * Calculates a force to apply to simulate attraction on an object.
 *
 * @param {Object} attractor The attracting object.
 * @returns {Object} A force to apply.
 */
PerlinBox.prototype.attract = function(attractor) {

  var force = BitShadowMachine.Vector.VectorSub(attractor.location, this.location),
    distance, strength;

  distance = force.mag();
  distance = exports.Utils.constrain(distance, 1, 30); // min = scale/8 (totally arbitrary); max = scale; the size of the attractor
  force.normalize();
  strength = (attractor.G * attractor.mass * this.mass) / (distance * distance);
  force.mult(strength);

  return force;
};

/**
 * Determines if this object is outside the world bounds.
 *
 * @private
 */
PerlinBox.prototype._checkWorldEdges = function() {

  if (this.wrapWorldEdges) {
    if (this.location.y < 0) { // top
      this.location.y = this.world.height;
      return;
    }

    if (this.location.x > this.world.width) { // right
      this.location.x = 0;
      return;
    }

    if (this.location.y > this.world.height) { // bottom
      this.location.y = 0;
      return;
    }

    if (this.location.x < 0) { // left
      this.location.x = this.world.width;
      return;
    }
  }

  if (this.wrapWorldEdgesSoft) {
    if (this.location.y < 0) { // top
      this.location.y = this.world.height + this.location.y;
      return;
    }

    if (this.location.x > this.world.width) { // right
      this.location.x = -(this.world.width - this.location.x);
      return;
    }

    if (this.location.y > this.world.height) { // bottom
      this.location.y = -(this.world.height - this.location.y);
      return;
    }

    if (this.location.x < 0) { // left
      this.location.x = this.world.width + this.location.x;
      return;
    }
  }

  if (this.location.y < 0) { // top
    this.velocity.mult(-this.bounciness);
    this.location.y = 0;
    return;
  }

  if (this.location.x > this.world.width) { // right
    this.velocity.mult(-this.bounciness);
    this.location.x = this.world.width;
    return;
  }

  if (this.location.y > this.world.height) { // bottom
    this.velocity.mult(-this.bounciness);
    this.location.y = this.world.height;
    return;
  }

  if (this.location.x < 0) { // left
    this.velocity.mult(-this.bounciness);
    this.location.x = 0;
    return;
  }
};