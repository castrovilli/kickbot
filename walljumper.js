var canvas = document.getElementById("game");

var manifest = {
	"images": {
		"wall1": "images/wall1.png",
		"wall2": "images/wall2.png",
		"laser": "images/laser.png",
		"spikes": "images/spikes.png",
		"bg": "images/bg.png",
	},
	"sounds": {
		"jump1": "audio/jump1.wav",
		"jump2": "audio/jump2.wav",
		"jump3": "audio/jump3.wav",
		"jump4": "audio/jump4.wav",
		"jump5": "audio/jump5.wav",
	},
	"fonts": [
	],
	"animations": {
	}
};

var game = new Splat.Game(canvas, manifest);

var player;

var walls = [];
var obstacles = [];
var onWall;
var dead = false;
var jumpSounds = ["jump1", "jump2", "jump3", "jump4", "jump5"];

var bgY = 0;

function drawFlipped(context) {
	context.save();
	context.scale(-1, 1);
	context.drawImage(this.sprite, -this.x - this.sprite.width, this.y);
	context.restore();
}

function jumpSound() {
	var i = Math.random() * jumpSounds.length |0;
	game.sounds.play(jumpSounds[i]);
}

function makeWall(y) {
	var wallImg = game.images.get(Math.random() > 0.5 ? "wall1" : "wall2");
	var wall = new Splat.AnimatedEntity(0, y, wallImg.width, wallImg.height, wallImg, 0, 0);
	walls.push(wall);

	wall = new Splat.AnimatedEntity(canvas.width - wallImg.width, y, wallImg.width, wallImg.height, wallImg, 0, 0);
	wall.draw = drawFlipped;
	walls.push(wall);

	if (y < -500 && Math.random() > 0.6) {
		var img = game.images.get(Math.random() > 0.5 ? "laser" : "spikes");
		var laser = new Splat.AnimatedEntity(wallImg.width - 8, y, img.width, img.height, img, 0, 0);
		if (Math.random() > 0.5) {
			laser.draw = drawFlipped;
			laser.x = canvas.width - wallImg.width - img.width + 8;
		}
		obstacles.push(laser);
	}
}

function populateWalls(scene) {
	var wallH = game.images.get("wall1").height;
	if (walls.length == 0) {
		makeWall(scene.camera.y + scene.camera.height - wallH);
	}
	while (walls[walls.length - 1].y + walls[walls.length - 1].height > scene.camera.y) {
		makeWall(walls[walls.length - 1].y - wallH);
	}
	while (walls[0].y > scene.camera.y + scene.camera.height) {
		walls.shift();
	}
	while (obstacles.length > 0 && obstacles[0].y > scene.camera.y + scene.camera.height) {
		obstacles.shift();
	}
}

function oscillate(current, period, height) {
	return Math.sin(current / period * Math.PI) * height;
}

game.scenes.add("title", new Splat.Scene(canvas, function() {
	dead = false;
	this.camera.vy = -0.6;

	var wallW = game.images.get("wall1").width;
	player = new Splat.Entity(wallW, canvas.height / 2, 50, 50);
	player.draw = function(context) {
		context.fillStyle = "#ff0000";
		context.fillRect(this.x, this.y, this.width, this.height);
	};

	this.clearTimers();
},
function(elapsedMillis) {
	bgY -= this.camera.vy / 1.5 * elapsedMillis;
	var bgH = game.images.get("bg").height;
	if (bgY > bgH) {
		bgY -= bgH;
	}

	if (player.y > this.camera.y + this.camera.height) {
		dead = true;
		this.camera.vy = 0;
		return;
	}

	for (var i = 0; i < walls.length; i++) {
		walls[i].move(elapsedMillis);
	}
	for (var i = 0; i < obstacles.length; i++) {
		obstacles[i].move(elapsedMillis);
	}
	populateWalls(this);

	// gravity
	player.vy += elapsedMillis * 0.003;
	if (onWall && !dead && player.vy > 0.5) {
		player.vy = 0.5;
	}

	var lju = this.timer("left jump up");
	if (lju > 200) {
		this.stopTimer("left jump up");
		lju = 0;
	}
	if (lju > 0) {
		player.vx = oscillate(lju + 100, 200, 1);
	}

	var rju = this.timer("right jump up");
	if (rju > 200) {
		this.stopTimer("right jump up");
		rju = 0;
	}
	if (rju > 0) {
		player.vx = -oscillate(rju + 100, 200, 1);
	}

	player.move(elapsedMillis);

	onWall = undefined;
	for (var i = 0; i < walls.length; i++) {
		var wall = walls[i];
		if (player.collides(wall)) {
			player.resolveLeftCollisionWith(wall);
			player.resolveRightCollisionWith(wall);
			player.resolveTopCollisionWith(wall);
			this.stopTimer("left jump up");
			this.stopTimer("right jump up");

			if (player.overlapsVert(wall)) {
				onWall = wall;
			}
		}
	}
	if (dead) {
		return;
	}
	for (var i = 0; i < obstacles.length; i++) {
		var obstacle = obstacles[i];
		if (player.collides(obstacle)) {
			this.startTimer("flash");
			dead = true;
			return;
		}
	}

	if (onWall) {
		var wallIsOnLeft = player.x > onWall.x;

		var left = false;
		var right = false;
		if (game.mouse.buttons[0]) {
			if (game.mouse.x < canvas.width / 2) {
				left = true;
			} else {
				right = true;
			}
			game.mouse.buttons[0] = false;
		} else if (game.keyboard.consumePressed("left")) {
			left = true;
		} else if (game.keyboard.consumePressed("right")) {
			right = true;
		}

		if (left) {
			if (wallIsOnLeft) {
				this.startTimer("left jump up");
			} else {
				player.vx = -1.0;
			}
			player.vy = -1.5;
			onWall = undefined;
			jumpSound();
		} else if (right) {
			if (wallIsOnLeft) {
				player.vx = 1.0;
			} else {
				this.startTimer("right jump up");
			}
			player.vy = -1.5;
			onWall = undefined;
			jumpSound();
		}
	}
},
function(context) {
	this.camera.drawAbsolute(context, function() {
		var bg = game.images.get("bg");
		for (var y = bgY - bg.height; y <= canvas.height; y += bg.height)  {
			context.drawImage(bg, 0, y);
		}
	});

	for (var i = 0; i < walls.length; i++) {
		walls[i].draw(context);
	}
	for (var i = 0; i < obstacles.length; i++) {
		obstacles[i].draw(context);
	}
	player.draw(context);

	var flashTime = this.timer("flash");
	var flashLen = 150;
	if (flashTime > flashLen) {
		this.stopTimer("flash");
		flashTime = 0;
	}
	if (flashTime > 0) {
		var opacity = oscillate(this.timer("flash"), flashLen, 1);
		context.fillStyle = "rgba(255, 255, 255, " + opacity + ")";
		context.fillRect(this.camera.x, this.camera.y, canvas.width, canvas.height);
	}
}));

game.scenes.switchTo("loading");
