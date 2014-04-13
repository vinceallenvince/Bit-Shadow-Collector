/*global BitShadowMachine */
/**
 * Creates a new Flocker.
 *
 * @constructor
 * @extends BitShadowMachine.Item
 * @param {Object} [opt_options=] A map of initial properties.
 */
function Flocker(opt_options) {
  var options = opt_options || {};
  options.name = options.name || 'Flocker';
  BitShadowMachine.Item.call(this, options);
}
BitShadowMachine.Utils.extend(Flocker, BitShadowMachine.Item);

/**
 * Initializes an instance.
 *
 * @param {Object} [opt_options=] A map of initial properties.
 * @param {boolean} [opt_options.followMouse = false] If true, object will follow mouse.
 * @param {number} [opt_options.maxSteeringForce = 10] Set the maximum strength of any steering force.
 * @param {Object} [opt_options.seekTarget = null] An object to seek.
 * @param {boolean} [opt_options.flocking = false] Set to true to apply flocking forces to this object.
 * @param {number} [opt_options.desiredSeparation = Twice the object's default width] Sets the desired separation from other objects when flocking = true.
 * @param {number} [opt_options.separateStrength = 1] The strength of the force to apply to separating when flocking = true.
 * @param {number} [opt_options.alignStrength = 1] The strength of the force to apply to aligning when flocking = true.
 * @param {number} [opt_options.cohesionStrength = 1] The strength of the force to apply to cohesion when flocking = true.
 * @param {Object} [opt_options.flowField = null] If a flow field is set, object will use it to apply a force.
 */
Flocker.prototype.init = function(opt_options) {

  var options = opt_options || {};

  this.followMouse = !!options.followMouse;
  this.maxSteeringForce = typeof options.maxSteeringForce === 'undefined' ? 10 : options.maxSteeringForce;
  this.seekTarget = options.seekTarget || null;
  this.flocking = !!options.flocking;
  this.desiredSeparation = typeof options.desiredSeparation === 'undefined' ? this.width * 2 : options.desiredSeparation;
  this.separateStrength = typeof options.separateStrength === 'undefined' ? 0.3 : options.separateStrength;
  this.alignStrength = typeof options.alignStrength === 'undefined' ? 0.2 : options.alignStrength;
  this.cohesionStrength = typeof options.cohesionStrength === 'undefined' ? 0.1 : options.cohesionStrength;
  this.flowField = options.flowField || null;

  //

  this.separateSumForceVector = new BitShadowMachine.Vector(); // used in Flocker.separate()
  this.alignSumForceVector = new BitShadowMachine.Vector(); // used in Flocker.align()
  this.cohesionSumForceVector = new BitShadowMachine.Vector(); // used in Flocker.cohesion()
  this.followTargetVector = new BitShadowMachine.Vector(); // used in Flocker.applyForces()
  this.followDesiredVelocity = new BitShadowMachine.Vector(); // used in Flocker.follow()

  //

  this.acceleration = options.acceleration || new BitShadowMachine.Vector();
  this.velocity = options.velocity || new BitShadowMachine.Vector();
  this.location = options.location || new BitShadowMachine.Vector(this.world.width / 2, this.world.height / 2);
  this.mass = typeof options.mass === 'undefined' ? 10 : options.mass;
  this._force = new BitShadowMachine.Vector();

  this.maxSpeed = typeof options.maxSpeed === 'undefined' ? 10 : options.maxSpeed;
  this.minSpeed = options.minSpeed || 0;

  this.checkWorldEdges = typeof options.checkWorldEdges === 'undefined' ? true : options.checkWorldEdges;
  this.wrapWorldEdges = typeof options.wrapWorldEdges === 'undefined' ? true : options.wrapWorldEdges;
  this.life = options.life || 0;
  this.lifespan = typeof options.lifespan === 'undefined' ? -1 : options.lifespan;
};

/**
 * Updates properties.
 */
Flocker.prototype.step = function() {
  if (!this.isStatic) {

    var repellers = BitShadowMachine.System._caches.Repeller;

    if (this.beforeStep) {
      this.beforeStep.apply(this);
    }

    if (this.world.c) { // friction
      friction = BitShadowMachine.Utils.clone(this.velocity);
      friction.mult(-1);
      friction.normalize();
      friction.mult(this.world.c);
      this.applyForce(friction);
    }
	  if (this.seekTarget) { // seek target
	    this.applyForce(this._seek(this.seekTarget));
	  }
    if (repellers && repellers.list.length > 0) { // repeller
      for (i = 0, max = repellers.list.length; i < max; i += 1) {
        if (this.id !== repellers.list[i].id) {
          this.applyForce(this.attract(repellers.list[i]));
        }
      }
    }
    this.flock(BitShadowMachine.System.getAllItemsByName('Flocker'));
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed, this.minSpeed);
    this.angle = BitShadowMachine.Utils.radiansToDegrees(Math.atan2(this.velocity.y, this.velocity.x));
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
Flocker.prototype.applyForce = function(force) {
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
Flocker.prototype.attract = function(attractor) {

  var force = BitShadowMachine.Vector.VectorSub(attractor.location, this.location),
    distance, strength;

  distance = force.mag();
  distance = BitShadowMachine.Utils.constrain(distance, this.width * this.height, attractor.scale); // min = scale/8 (totally arbitrary); max = scale; the size of the attractor
  force.normalize();
  strength = (attractor.G * attractor.mass * this.mass) / (distance * distance);
  force.mult(strength);

  return force;
};

/**
 * Bundles flocking behaviors (separate, align, cohesion) into one call.
 *
 * @returns {Object} This object's acceleration vector.
 */
Flocker.prototype.flock = function(items) {
  this.applyForce(this.separate(items).mult(this.separateStrength));
  this.applyForce(this.align(items).mult(this.alignStrength));
  this.applyForce(this.cohesion(items).mult(this.cohesionStrength));
  return this.acceleration;
};

/**
 * Loops through a passed items array and calculates a force to apply
 * to avoid all items.
 *
 * @param {array} items An array of Flora items.
 * @returns {Object} A force to apply.
 */
Flocker.prototype.separate = function(items) {

  var i, max, item, diff, d,
  sum, count = 0, steer;

  this.separateSumForceVector.x = 0;
  this.separateSumForceVector.y = 0;
  sum = this.separateSumForceVector;

  for (i = 0, max = items.length; i < max; i += 1) {
    item = items[i];
    if (this.name === item.name && this.id !== item.id) {

      d = this.location.distance(item.location);

      if (d > 0 && d < this.desiredSeparation) {
        diff = BitShadowMachine.Vector.VectorSub(this.location, item.location);
        diff.normalize();
        diff.div(d);
        sum.add(diff);
        count++;
      }
    }
  }
  if (count > 0) {
    sum.div(count);
    sum.normalize();
    sum.mult(this.maxSpeed);
    sum.sub(this.velocity);
    sum.limit(this.maxSteeringForce);
    return sum;
  }
  return new BitShadowMachine.Vector();
};

/**
 * Loops through a passed items array and calculates a force to apply
 * to align with all items.
 *
 * @param {array} items An array of Flora items.
 * @returns {Object} A force to apply.
 */
Flocker.prototype.align = function(items) {

  var i, max, item, d,
    neighbordist = this.width * 2,
    sum, count = 0, steer;

  this.alignSumForceVector.x = 0;
  this.alignSumForceVector.y = 0;
  sum = this.alignSumForceVector;

  for (i = 0, max = items.length; i < max; i += 1) {
    item = items[i];
    d = this.location.distance(item.location);

    if ((d > 0) && (d < neighbordist)) {
      if (this.name === item.name && this.id !== item.id) {
        sum.add(item.velocity);
        count++;
      }
    }
  }

  if (count > 0) {
    sum.div(count);
    sum.normalize();
    sum.mult(this.maxSpeed);
    sum.sub(this.velocity);
    sum.limit(this.maxSteeringForce);
    return sum;
  }
  return new BitShadowMachine.Vector();
};

/**
 * Loops through a passed items array and calculates a force to apply
 * to stay close to all items.
 *
 * @param {array} items An array of Flora items.
 * @returns {Object} A force to apply.
 */
Flocker.prototype.cohesion = function(items) {

  var i, max, item, d,
    neighbordist = 10,
    sum, count = 0, desiredVelocity, steer;

  this.cohesionSumForceVector.x = 0;
  this.cohesionSumForceVector.y = 0;
  sum = this.cohesionSumForceVector;

  for (i = 0, max = items.length; i < max; i += 1) {
    item = items[i];
    d = this.location.distance(item.location);

    if ((d > 0) && (d < neighbordist)) {
      if (this.name === item.name && this.id !== item.id) {
        sum.add(item.location);
        count++;
      }
    }
  }

  if (count > 0) {
    sum.div(count);
    sum.sub(this.location);
    sum.normalize();
    sum.mult(this.maxSpeed);
    sum.sub(this.velocity);
    sum.limit(this.maxSteeringForce);
    return sum;
  }
  return new BitShadowMachine.Vector();
};

/**
 * Calculates a steering force to apply to an object seeking another object.
 *
 * @param {Object} target The object to seek.
 * @returns {Object} The force to apply.
 * @private
 */
Flocker.prototype._seek = function(target) {

  var world = this.world,
    desiredVelocity = BitShadowMachine.Vector.VectorSub(target.location, this.location),
    distanceToTarget = desiredVelocity.mag();

  desiredVelocity.normalize();

  if (distanceToTarget < world.width / 2) { // slow down to arrive at target
    var m = BitShadowMachine.Utils.map(distanceToTarget, 0, world.width / 2, 0, this.maxSpeed);
    desiredVelocity.mult(m);
  } else {
    desiredVelocity.mult(this.maxSpeed);
  }

  desiredVelocity.sub(this.velocity);
  desiredVelocity.limit(this.maxSteeringForce);

  return desiredVelocity;
};

/**
 * Determines if this object is outside the world bounds.
 *
 * @private
 */
Flocker.prototype._checkWorldEdges = function() {

  var x, y, worldRight = this.world.width,
      worldBottom = this.world.height,
      location = this.location,
      velocity = this.velocity,
      width = this.width,
      height = this.height,
      bounciness = this.bounciness;

  // transform origin is at the center of the object
  if (this.wrapWorldEdges) {

    x = location.x;
    y = location.y;

    if (location.x > worldRight + this.width) {
      location.x = -this.width;
    } else if (location.x < -this.width) {
      location.x = worldRight + this.width;
    }

    if (location.y > worldBottom + this.height) {
      location.y = -this.height;
    } else if (location.y < -this.height) {
      location.y = worldBottom + this.height;
    }
  }
};
