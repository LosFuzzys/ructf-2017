import $ from "jquery";
import * as THREE from "three";
import station from "./station";
import * as THREE_particle from "./particle";
import Stats from "stats.js";
import _ from "underscore";

const countdown_start = new Date(2017, 3, 16, 10, 0, 0); // month from 0
const countdown_end = new Date(2017, 3, 16, 20, 20, 0);
const YEKT_timezone_offset = 5 * 60 * 60 * 1000;
const sprite_coeff = 3;
const canvasWidth = 182 * sprite_coeff;
const canvasHeight = 62 * sprite_coeff;

export default class View {

	constructor(controller) {
		this.controller = controller;
		this.model = null;
		this.scoreboardContainer = $("#scoreboard-container");

		controller.on('start', m => {
			this.model = m;
			this.init();
		});
		controller.on('showArrow', arrowData => {
			this.showArrow(arrowData);
		});
		controller.on('score', () => {
			this.drawScoreboard();
			this.updateTeamsTextures();
		});
		controller.on('servicesStatuses', () => {
			this.drawServicesStatusesAndStat();
			this.updateTeamsTextures();
		});
		controller.on('flagStat', () => {
			$("#attacks-value").text(this.model.flagsCount);
		});
	}

	init() {
		this.initThree();
		View.countdown();
		this.loadLogos();
	}

	updateTeamsTextures() {
		for (let i=0; i<this.model.teams.length; i++) {
			const team = this.model.teams[i];
			View.drawSpriteTexture(team);
			team.texture.needsUpdate = true;
		}
	}

	loadLogos() {
		for (let i=0; i<this.model.teams.length; i++) {
			View.loadLogo(this.model.teams[i]);
		}
	}

	static loadLogo(team) {
		const logoImg = new Image();
		logoImg.src = team.logoUrl;
		team.logoImage = logoImg;
		logoImg.onload = function(){
			if (logoImg.naturalWidth > 0) {
				View.drawSpriteTexture(team);
				team.texture.needsUpdate = true;
			}
		};
		logoImg.onerror = function() {
			setTimeout(function() {
				View.loadLogo(team);
			}, 1);
		};
	}

	drawScoreboard() {
		this.scoreboardContainer.empty();
		const table = $("<table></table>");
		const $container = $("#container");
		const img_height = Math.max(Math.ceil(($container.height() - 60) / this.model.teams.length - 10), 3);
		const place_size = Math.max(img_height - 4, 3);
		const teams = _.sortBy(this.model.teams, function(t){ return parseFloat(t.score); }).reverse();
		for (let i=0; i<teams.length; i++) {
			const team = teams[i];
			table.append($(`<tr><td><div class="place" style="width:${place_size}px;height:${place_size}px;line-height:${place_size}px;">${i + 1}</div></td>
<td><img height='${img_height}' width='${img_height}' src='${team.logoUrl}'/></td><td><div>${View.escape(team.name)}</div></td><td><div>${team.score}</div></td></tr>`));
		}
		this.scoreboardContainer.append(table);
	}

	static countdown() {
		let now = new Date().getTime();
		const utcOffsetMilliseconds = new Date().getTimezoneOffset() * 60000;
		const yektCorrection = utcOffsetMilliseconds + YEKT_timezone_offset;
		now += yektCorrection;
		if (now > countdown_start.getTime()) {
			const $countdown = $("#countdown-value");
			if(now > countdown_end.getTime()) {
				$countdown.text("00:00:00");
				return;
			}
			const diff = countdown_end.getTime() - now;
			const str = milisecondsToTimeStr(diff);
			$countdown.text(str);
		}
		setTimeout(function() { View.countdown(); }, 100);

		function milisecondsToTimeStr(msec) {
			const hh = Math.floor(msec / 1000 / 60 / 60);
			msec -= hh * 1000 * 60 * 60;
			const mm = Math.floor(msec / 1000 / 60);
			msec -= mm * 1000 * 60;
			const ss = Math.floor(msec / 1000);
			msec -= ss * 1000;
			return `${hh}:${leadingZero(mm)}:${leadingZero(ss)}`;
		}

		function leadingZero(n) {
			return n < 10 ? "0" + n : n;
		}
	}

	drawServicesStatusesAndStat() {
		const _this = this;
		let teamsWithAliveService = 0; // number of commands with at least 1 service
		this.model.teams.forEach(function (nData) {
			let hasUp = false;
			for (let i = 0; i < _this.model.services.length; i++) {
				const isUp = _this.model.services[i].visible && nData.servicesStatuses[i];
				hasUp = hasUp || isUp;
			}
			if (hasUp)
				teamsWithAliveService++;
		});
		$("#alive-value").text(teamsWithAliveService);
	}

	static escape(text) {
		return $("<div>").text(text).html();
	}

	showArrow(arrowData) {
		if(!arrowData.svc.visible)
			return;
		if(!arrowData.from.pos) // nodes does not init yet
			return;
		const posFrom = arrowData.from.pos.clone();
		const posTo = arrowData.to.pos.clone();
		const spline_points = View.getSplinePoints(posFrom.normalize().multiplyScalar(44), posTo.normalize().multiplyScalar(44));
		this.createArrow(spline_points, arrowData.svc.color);
		setTimeout(function() {
			arrowData.to.lastExplosionTime = new Date().getTime();
		}, 3000);
	}

	createArrow(points, color) {
		const particleSystem = new THREE_particle.GPUParticleSystem({
			maxParticles: 1500,
			particleSpriteTex: this.particleSpriteTex
		});
		const spline = new THREE.CatmullRomCurve3(points);
		this.planetGroup.add(particleSystem);
		const arrow = {
			particleSystem,
			spline,
			timer: 0,
			creationTime: new Date().getTime(),
			color: new THREE.Color(color)
		};
		this.arrows.push(arrow);
	}

	static getSplinePoints(pos0, pos1) {
		const result = [pos0];
		const center_vec = new THREE.Vector3(0.01, 0, 0).add(pos0).add(pos1).normalize();
		result.push(pos0.clone().normalize().multiplyScalar(45).add(pos1.clone().normalize().multiplyScalar(3)).normalize().multiplyScalar(44.5));
		result.push(pos0.clone().normalize().add(center_vec).normalize().multiplyScalar(46));
		result.push(center_vec.clone().normalize().multiplyScalar(47));
		result.push(pos1.clone().normalize().add(center_vec).normalize().multiplyScalar(46));
		result.push(pos1.clone().normalize().multiplyScalar(45).add(pos0.clone().normalize().multiplyScalar(1)).normalize().multiplyScalar(45.5));
		result.push(pos1);
		return result;
	}

	static drawSpriteTexture(team) {
		const canvas = team.canvas;

		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		const context = canvas.getContext('2d');

		context.fillStyle = "rgba(255, 255, 255, 0.5)";
		context.fillRect(0, 0, canvasWidth, canvasHeight);

		const borderWidth = 1.5 * sprite_coeff;
		context.fillStyle = "rgba(34, 3, 71, 0.59)";
		context.fillRect(borderWidth, borderWidth, canvasWidth - borderWidth * 2, canvasHeight - borderWidth * 2);

		if (team.logoImage !== undefined && team.logoImage.complete && team.logoImage.naturalWidth > 0) {
			context.drawImage(team.logoImage, 6 * sprite_coeff, 6 * sprite_coeff, 50 * sprite_coeff, 50 * sprite_coeff);
		}

		const textLeftOffset = (6 + 50 + 6) * sprite_coeff;

		context.fillStyle = "rgba(34, 3, 71, 1.0)";
		context.fillRect(textLeftOffset, 7 * sprite_coeff, 48 * sprite_coeff, 4 * sprite_coeff);

		context.fillStyle = "rgba(206, 65, 138, 1.0)";
		for (let i = 0; i < _.filter(team.servicesStatuses, function(ss) { return ss; }).length; i++)
			context.fillRect(textLeftOffset + i * 8 * sprite_coeff, 7 * sprite_coeff, 7 * sprite_coeff, 4 * sprite_coeff);

		const grd = context.createLinearGradient(0, 0, canvasWidth, 0);
		grd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
		grd.addColorStop(0.84, "rgba(255, 255, 255, 1.0)");
		grd.addColorStop(0.99, "rgba(255, 255, 255, 0.0)");
		grd.addColorStop(1, "rgba(255, 255, 255, 0.0)");
		context.fillStyle = grd;
		context.font = "Bold " + (16 * sprite_coeff) + "px Roboto";
		context.fillText(team.name, textLeftOffset, 32 * sprite_coeff);

		context.font = (16 * sprite_coeff) + "px Roboto";
		context.fillText(team.score, textLeftOffset, 52 * sprite_coeff);

		if (team.place !== null) {
			context.fillStyle = "rgba(175, 197, 255, 1.0)";
			context.font = "Bold " + (14 * sprite_coeff) + "px Roboto";
			let place = team.place;
			const dashIndex = place.indexOf("-");
			if (dashIndex !== -1)
				place = place.substring(0, dashIndex);
			if (place.length > 1)
				context.fillText(place, 162 * sprite_coeff, 15 * sprite_coeff);
			else
				context.fillText(place, 169 * sprite_coeff, 15 * sprite_coeff);
		}
	}

	initThree() {
		const teams = this.model.teams;
		const $container = $("#container");
		let SCREEN_WIDTH = $container.width();
		let SCREEN_HEIGHT = $container.height();
		let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

		let camera;
		let renderer;
		const planetGroup = new THREE.Object3D();
		this.planetGroup = planetGroup;
		const scene = new THREE.Scene();
		this.scene = scene;

		const clock = new THREE.Clock();
		let lon = 0, lat = 0;
		let phi = 0, theta = 0;

		let onPointerDownPointerX, onPointerDownPointerY, onPointerDownLon, onPointerDownLat;

		const textureLoader = new THREE.TextureLoader();
		this.particleSpriteTex = textureLoader.load("static/img/particle.png");
		const planetBumpTex = textureLoader.load("static/img/planet/Bump.jpg");
		const planetDiffuseTex = textureLoader.load("static/img/planet/Diffuse.jpg");
		const planetGlossTex = textureLoader.load("static/img/planet/Gloss.jpg");
		const planetCloudsTex = textureLoader.load("static/img/planet/Clouds.jpg");

		const stationBumpTex = textureLoader.load("static/img/station/Bump.png");
		const stationDiffuseTex = textureLoader.load("static/img/station/Diffuse.jpg");

		const options = {
			position: new THREE.Vector3(),
			positionRandomness: 0.45,
			velocityRandomness: 0.43,
			colorRandomness: 0,
			turbulence: 0.5,
			lifetime: 0.8,
			size: 6,
			sizeRandomness: 3
		};

		const spawnerOptions = {
			spawnRate: 500
		};

		this.arrows = [];
		const _this = this;

		const stats = new Stats();
		stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
		$("#stats-container").append(stats.dom);

		init();
		asyncEvents();
		animate();

		function init() {
			renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
			renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			renderer.shadowMap.enabled = true;
			$container.append(renderer.domElement);

			camera = new THREE.PerspectiveCamera(55, aspect, 1, 1000);

			const light = new THREE.PointLight(0xdddddd, 1.5, 200, 1);
			light.position.set(65, 20, 85);
			light.shadow.mapSize.width = 1024;
			light.shadow.mapSize.height = 1024;
			light.castShadow = true;
			light.shadow.camera.left = -45;
			light.shadow.camera.right = 45;
			light.shadow.camera.top = 45;
			light.shadow.camera.bottom = -45;
			light.shadow.radius = 3;
			//light.shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
			scene.add(light);
			//scene.add(light.shadowCameraHelper);


			scene.add(new THREE.AmbientLight(0x444444));

			//planetBumpTex.magFilter = THREE.LinearMipMapLinearFilter;
			//planetDiffuseTex.magFilter = THREE.LinearMipMapLinearFilter;
			const planetMaterial = new THREE.MeshPhongMaterial({
				bumpMap: planetBumpTex,
				bumpScale: 0.3,
				map: planetDiffuseTex,
				specularMap: planetGlossTex,
				specular: new THREE.Color(0x999999),
				shininess: 14
			});
			const cloudMaterial  = new THREE.MeshPhongMaterial({
				alphaMap : planetCloudsTex,
				opacity : 1,
				transparent : true,
				depthWrite : false,
			});
			const sphere = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(40, 4), planetMaterial);
			_this.clouds = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(40.7, 4), cloudMaterial);
			sphere.castShadow = true;
			sphere.position.set(0, 0, 0);
			sphere.receiveShadow = true;
			_this.clouds.castShadow = false;
			_this.clouds.position.set(0, 0, 0);
			_this.clouds.receiveShadow = false;
			planetGroup.add(sphere);
			planetGroup.add(_this.clouds);

			const atmosphereMaterial = new THREE.ShaderMaterial(
				{
					uniforms:
						{
							"c":   { type: "f", value: 1.0 },
							"p":   { type: "f", value: 1.4 },
							glowColor: { type: "c", value: new THREE.Color(0xff4fea) },
							viewVector: { type: "v3", value: camera.position }
						},
					vertexShader:   document.getElementById( 'vertexShader'   ).textContent,
					fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
					side: THREE.FrontSide,
					blending: THREE.AdditiveBlending,
					transparent: true
				}   );
			const glow = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(40.7, 4), atmosphereMaterial);
			glow.position.set(0, 0, 0);
			scene.add(glow);

			calculateNodesPositions();

			const loader = new THREE.JSONLoader();
			const {geometry, materials} = loader.parse(station, "");
			for (let i = 0; i < teams.length; i++) {
				const team = teams[i];
				const material = materials[0];
				material.map = stationDiffuseTex;
				material.bumpMap = stationBumpTex;
				const node = new THREE.Mesh(geometry.clone(), material);
				node.scale.set(1.2, 1.2, 1.2);
				node.castShadow = true;
				node.receiveShadow = true;
				const myDirectionVector = new THREE.Vector3(team.point[0], team.point[1], team.point[2]);
				const nodePosition = setNodePosition(node, myDirectionVector, 44);
				team.node = node;
				team.pos = nodePosition;
				planetGroup.add(node);

				const nodeGlossMaterial = new THREE.MeshPhongMaterial(
					{
						bumpMap : stationBumpTex,
						opacity : 0,
						color: 0xff0000,
						side: THREE.FrontSide,
						transparent: true
					}
				);
				const nodeGloss = new THREE.Mesh(geometry.clone(), nodeGlossMaterial);
				nodeGloss.scale.set(1.22, 1.22, 1.22);
				const glossPosition = setNodePosition(nodeGloss, myDirectionVector, 44.012);
				nodeGloss.position.set(glossPosition.x, glossPosition.y, glossPosition.z);
				planetGroup.add(nodeGloss);
				team.glossMaterial = nodeGlossMaterial;

				const sprite = makeTextSprite(team);
				const spritePosition = myDirectionVector.clone().multiplyScalar(52);
				sprite.position.set(spritePosition.x, spritePosition.y, spritePosition.z);
				team.sprite = sprite;
				planetGroup.add(sprite);
			}

			scene.add(planetGroup);

			//const axes = new THREE.AxisHelper(100);
			//scene.add(axes);

			window.addEventListener('resize', onWindowResized, false);
			document.addEventListener('mousedown', onDocumentMouseDown, false);
			document.addEventListener('wheel', onDocumentMouseWheel, false);
		}

		function setNodePosition(node, myDirectionVector, coeff) {
			const nodePosition = myDirectionVector.clone().multiplyScalar(coeff);
			node.position.set(nodePosition.x, nodePosition.y, nodePosition.z);
			let mx = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), myDirectionVector, new THREE.Vector3(0, 1, 0));
			let qt = new THREE.Quaternion().setFromRotationMatrix(mx);
			node.rotateY((90 * Math.PI)/180);
			node.quaternion.copy(qt);
			return nodePosition;
		}

		function calculateNodesPositions() {
			let nodes_points = [];
			let samplesCount = teams.length;
			while (nodes_points.length < teams.length) {
				nodes_points = fibonacci_sphere(samplesCount);
				nodes_points = nodes_points.filter(p => p[1] >= -0.5 && p[1] <= 0.5);
				samplesCount++;
			}
			if (nodes_points.length > teams.length)
				nodes_points = nodes_points.slice(0, teams.length);
			for(let i=0; i<nodes_points.length; i++)
				teams[i].point = nodes_points[i];
		}

		function fibonacci_sphere(samples) { // http://stackoverflow.com/questions/9600801/evenly-distributing-n-points-on-a-sphere
			const rnd = 1;
			const points = [];
			const offset = 2. / samples;
			const increment = Math.PI * (3. - Math.sqrt(5.));

			for (let i = 0; i<samples; i++) {
				let y = ((i * offset) - 1) + (offset / 2);
				let r = Math.sqrt(1 - Math.pow(y, 2));

				let phi = ((i + rnd) % samples) * increment;

				let x = Math.cos(phi) * r;
				let z = Math.sin(phi) * r;

				points.push([x, y, z]);
			}
			return points;
		}

		function makeTextSprite(team) {
			team.canvas = document.createElement('canvas');
			View.drawSpriteTexture(team);

			const texture = new THREE.Texture(team.canvas);
			team.texture = texture;
			texture.magFilter = THREE.LinearFilter;
			texture.minFilter = THREE.NearestMipMapNearestFilter; // https://threejs.org/docs/api/constants/Textures.html
			texture.needsUpdate = true;
			texture.anisotropy = renderer.getMaxAnisotropy();
			const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
			const sprite = new THREE.Sprite(spriteMaterial);
			sprite.scale.set(canvasWidth * 0.06 / sprite_coeff, canvasHeight * 0.06 / sprite_coeff, 1.0);
			return sprite;
		}

		function onWindowResized() {
			SCREEN_WIDTH = $container.width();
			SCREEN_HEIGHT = $container.height();
			renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
			camera.aspect = aspect;
			camera.updateProjectionMatrix();
			_this.drawScoreboard();
		}

		function onDocumentMouseDown(event) {
			event.preventDefault();
			onPointerDownPointerX = event.clientX;
			onPointerDownPointerY = event.clientY;
			onPointerDownLon = lon;
			onPointerDownLat = lat;
			document.addEventListener('mousemove', onDocumentMouseMove, false);
			document.addEventListener('mouseup', onDocumentMouseUp, false);
		}

		function onDocumentMouseMove(event) {
			lon = (event.clientX - onPointerDownPointerX) * 0.1 + onPointerDownLon;
			lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
		}

		function onDocumentMouseUp() {
			document.removeEventListener('mousemove', onDocumentMouseMove, false);
			document.removeEventListener('mouseup', onDocumentMouseUp, false);
		}

		function onDocumentMouseWheel(event) {
			let newFov = camera.fov + (event.deltaY * 0.01);
			if (newFov < 50)
				newFov = 50;
			else if (newFov > 100)
				newFov = 100;
			camera.fov = newFov;
			camera.updateProjectionMatrix();
		}

		function animate() {
			stats.begin();
			render();
			stats.end();
			requestAnimationFrame(animate);
		}

		function removeParticleSystemsIfNeeded() {
			const now = new Date().getTime();
			_this.arrows = _this.arrows.filter(function(a) {
				if(now - a.creationTime < 4.5 * 1000)
					return true;
				planetGroup.remove(a.particleSystem);
				a.particleSystem.dispose();
				return false;
			});
		}

		function asyncEvents() {
			setInterval(removeParticleSystemsIfNeeded, 1000);
		}

		function render() {
			lat = Math.max(-89, Math.min(89, lat));
			phi = THREE.Math.degToRad(lat - 90);
			theta = THREE.Math.degToRad(lon - 90);
			camera.position.x = 100 * Math.sin(phi) * Math.cos(theta);
			camera.position.y = 100 * Math.cos(phi);
			camera.position.z = 100 * Math.sin(phi) * Math.sin(theta);
			camera.lookAt(scene.position);
			const delta = clock.getDelta();
			planetGroup.rotateY(delta / 40);
			//_this.clouds.rotateY(delta / 300);

			removeParticleSystemsIfNeeded();
			const now = new Date().getTime();
			for (let i = 0; i < _this.arrows.length; i++) {
				const arrow = _this.arrows[i];
				if (now - arrow.creationTime < 3 * 1000) {
					if (delta > 0) {
						options.color = arrow.color.getHex();
						const steps = 10;
						for (let step = 0; step < steps; step++) {
							arrow.timer += delta / 3 / steps;
							options.position = arrow.spline.getPoint(arrow.timer);
							for (let x = 0; x < spawnerOptions.spawnRate * delta / steps; x++) {
								arrow.particleSystem.spawnParticle(options);
							}
						}
					}
				} else
					arrow.timer += delta / 3;
				arrow.particleSystem.update(arrow.timer);
			}

			for (let i = 0; i< _this.model.teams.length; i++) {
				const team = _this.model.teams[i];
				if (team.lastExplosionTime === 0)
					continue;
				if (team.lastExplosionTime <= now && team.lastExplosionTime + 1000 >= now) {
					team.glossMaterial.opacity = 0.65 - (now - team.lastExplosionTime) / 1000 * 0.65;
				} else {
					team.glossMaterial.opacity = 0;
					team.lastExplosionTime = 0;
				}
			}

			renderer.render(scene, camera);
		}
	}
}