import $ from "jquery";
import md5 from "md5";
import * as THREE from "three";
import * as THREE_particle from "./particle";
import Stats from "stats.js";


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
		});
		controller.on('servicesStatuses', () => {
			this.drawServicesStatusesAndStat();
		});
		controller.on('flagStat', () => {
			$("#attacks").find(".value").text(this.model.flagsCount);
		});
	}

	init() {
		this.initThree();
	}

	drawScoreboard() {
		this.scoreboardContainer.empty();
		const table = $("<table></table>");
		const $container = $("#container");
		const img_height = Math.max(Math.ceil(($container.height() - 60) / this.model.teams.length - 10), 3);
		const place_size = Math.max(img_height - 4, 3);
		for (let i=0; i<this.model.teams.length; i++) {
			const team = this.model.teams[i];
			table.append($(`<tr><td><div class="place" style="width:${place_size}px;height:${place_size}px;">${i}</div></td>
<td><img height='${img_height}' src='${View.getLogo()}'/></td><td></td><td>${View.escape(team.name)}</td><td>${team.score}</td></tr>`));
		}
		this.scoreboardContainer.append(table);
	}

	drawServicesStatusesAndStat() {
		const _this = this;
		let teamsWithAliveService = 0; // количество команд с хотя бы 1 сервисом
		this.model.teams.forEach(function (nData) {
			let hasUp = false;
			for (let i = 0; i < _this.model.services.length; i++) {
				const isUp = _this.model.services[i].visible && nData.servicesStatuses[i];
				hasUp = hasUp || isUp;
			}
			if (hasUp)
				teamsWithAliveService++;
		});
		$("#alive").find(".value").text(teamsWithAliveService);
	}

	static getLogo(nodeData) {
		//return "https://ructfe.org/logos/" + md5(nodeData.name) + ".png"; // TODO
		return "https://ructfe.org/static/img/teams/a0d934499096790a8d0c50a6002164b7.png";
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
	}

	createArrow(points, color) {
		const particleSystem = new THREE_particle.GPUParticleSystem({
			maxParticles: 10000,
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
		result.push(pos0.clone().normalize().multiplyScalar(46).add(pos1.clone().normalize()));
		result.push(new THREE.Vector3(0.01, 0, 0).add(pos0).add(pos1).normalize().multiplyScalar(46));
		result.push(pos1.clone().normalize().multiplyScalar(46).add(pos0.clone().normalize()));
		result.push(pos1);
		return result;
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

		const stationBumpTex = textureLoader.load("static/img/station/Bump.png");
		const stationDiffuseTex = textureLoader.load("static/img/station/Diffuse.png");
		const stationOpacityTex = textureLoader.load("static/img/station/Opacity.png");
		const stationSelfIlluminationTex = textureLoader.load("static/img/station/Self-Illumination.png");

		const options = {
			position: new THREE.Vector3(),
			positionRandomness: 1.2,
			velocityRandomness: 0.43,
			colorRandomness: 0,
			turbulence: 0.5,
			lifetime: 0.5,
			size: 6,
			sizeRandomness: 3
		};

		const spawnerOptions = {
			spawnRate: 4000
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
			camera = new THREE.PerspectiveCamera(55, aspect, 1, 1000);
			camera.position.set(0, 0, 100);

			const light = new THREE.DirectionalLight(0xdfebff, 1);
			light.position.set(75, 20, 60);
			light.shadow.mapSize.width = 2048; // default is 512
			light.shadow.mapSize.height = 2048; // default is 512
			light.castShadow = true;
			light.shadow.camera.left = -50;
			light.shadow.camera.right = 50;
			light.shadow.camera.top = 50;
			light.shadow.camera.bottom = -50;
			light.shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
			scene.add(light);
			scene.add(light.shadowCameraHelper);


			scene.add(new THREE.AmbientLight(0x666666));

			const planetMaterial = new THREE.MeshPhongMaterial({
				bumpMap: planetBumpTex,
				map: planetDiffuseTex,
				specularMap: planetGlossTex,
			});
			const sphere = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(40, 4), planetMaterial);
			sphere.castShadow = true;
			sphere.position.set(0, 0, 0);
			sphere.receiveShadow = true;
			planetGroup.add(sphere);

			calculateNodesPositions();

			const loader = new THREE.JSONLoader();
			loader.load( 'static/img/station/station.json', function ( geometry, materials ) {
				for (let i = 0; i < teams.length; i++) {
					const team = teams[i];
					const material = materials[0];
					material.map = stationDiffuseTex;
					material.bumpMap = stationBumpTex;
					material.emissiveMap = stationSelfIlluminationTex;
					const node = new THREE.Mesh( geometry, material );
					node.scale.set( 1.2, 1.2, 1.2 );
					node.castShadow = true;
					node.receiveShadow = true;
					const myDirectionVector = new THREE.Vector3(team.point[0], team.point[1], team.point[2]);
					const nodePosition = myDirectionVector.clone().multiplyScalar(43);
					node.position.set(nodePosition.x, nodePosition.y, nodePosition.z);
					let mx = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), myDirectionVector, new THREE.Vector3(0, 1, 0));
					let qt = new THREE.Quaternion().setFromRotationMatrix(mx);
					node.rotateY((90 * Math.PI)/180);
					node.quaternion.copy(qt);
					team.node = node;
					team.pos = nodePosition;
					planetGroup.add(node);

					const sprite = makeTextSprite(" " + team.name + " ",
						{
							fontsize: 48,
							borderColor: {r: 255, g: 0, b: 0, a: 1.0},
							backgroundColor: {r: 255, g: 100, b: 100, a: 0.8}
						});
					const spritePosition = myDirectionVector.clone().multiplyScalar(52);
					sprite.position.set(spritePosition.x, spritePosition.y, spritePosition.z);
					teams[i].sprite = sprite;
					planetGroup.add(sprite);
				}
			});

			scene.add(planetGroup);

			const axes = new THREE.AxisHelper(100);
			scene.add(axes);

			renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
			renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			renderer.shadowMap.enabled = true;

			$container.append(renderer.domElement);
			window.addEventListener('resize', onWindowResized, false);
			document.addEventListener('mousedown', onDocumentMouseDown, false);
			document.addEventListener('wheel', onDocumentMouseWheel, false);
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

		function genNode() {
			const geometry = new THREE.Geometry();
			const ISLAND_WIDTH = 8;
			const ISLAND_HEIGHT = ISLAND_WIDTH * 0.866; // sqrt(3)/2
			const fig = [{x: ISLAND_WIDTH / 4 , y: 0},
				{x: ISLAND_WIDTH * 3 / 4, y: 0},
				{x: ISLAND_WIDTH, y: ISLAND_HEIGHT / 2},
				{x: ISLAND_WIDTH * 3 / 4, y: ISLAND_HEIGHT},
				{x: ISLAND_WIDTH / 4 , y: ISLAND_HEIGHT},
				{x: 0, y: ISLAND_HEIGHT / 2}];
			for (let i=0; i<fig.length; i++)
				geometry.vertices.push(new THREE.Vector3(fig[i].x - ISLAND_WIDTH / 2, fig[i].y - ISLAND_HEIGHT / 2, -1));
			for (let i=0; i<fig.length; i++)
				geometry.vertices.push(new THREE.Vector3(fig[i].x  - ISLAND_WIDTH / 2, fig[i].y - ISLAND_HEIGHT / 2, 1));
			const faces1 = [[0,5,1],[1,3,2],[3,5,4],[1,5,3]];
			const faces2 = [[0,1,5],[1,2,3],[3,4,5],[1,3,5]];
			for (let i=0; i<faces1.length; i++)
				geometry.faces.push(new THREE.Face3(faces1[i][0], faces1[i][1], faces1[i][2]));
			for (let i=0; i<faces2.length; i++)
				geometry.faces.push(new THREE.Face3(faces2[i][0] + 6, faces2[i][1] + 6, faces2[i][2] + 6));
			const borders = [[0,7,6],[1,8,7],[2,9,8],[3,10,9],[4,11,10],[5,6,11],
				[0,1,7],[1,2,8],[2,3,9],[3,4,10],[4,5,11],[5,0,6]];
			for (let i=0; i<borders.length; i++)
				geometry.faces.push(new THREE.Face3(borders[i][0], borders[i][1], borders[i][2]));
			geometry.computeVertexNormals();
			const stationMaterial = new THREE.MeshPhongMaterial({
				bumpMap: stationBumpTex,
				map: stationDiffuseTex,
				//alphaMap: stationOpacityTex,
				//emissiveMap: stationSelfIlluminationTex,
			});
			return new THREE.Mesh(geometry, stationMaterial);
		}

		function genPlane() {
			const geometry = new THREE.Geometry();
			const ISLAND_WIDTH = 8;
			const ISLAND_HEIGHT = ISLAND_WIDTH * 0.866; // sqrt(3)/2
			const fig = [{x: ISLAND_WIDTH / 4 , y: 0},
				{x: ISLAND_WIDTH * 3 / 4, y: 0},
				{x: ISLAND_WIDTH, y: ISLAND_HEIGHT / 2},
				{x: ISLAND_WIDTH * 3 / 4, y: ISLAND_HEIGHT},
				{x: ISLAND_WIDTH / 4 , y: ISLAND_HEIGHT},
				{x: 0, y: ISLAND_HEIGHT / 2}];
			for (let i=0; i<fig.length; i++)
				geometry.vertices.push(new THREE.Vector3(fig[i].x - ISLAND_WIDTH / 2, fig[i].y - ISLAND_HEIGHT / 2, -1));
			for (let i=0; i<fig.length; i++)
				geometry.vertices.push(new THREE.Vector3(fig[i].x  - ISLAND_WIDTH / 2, fig[i].y - ISLAND_HEIGHT / 2, 1));
			const faces1 = [[0,5,1],[1,3,2],[3,5,4],[1,5,3]];
			const faces2 = [[0,1,5],[1,2,3],[3,4,5],[1,3,5]];
			for (let i=0; i<faces1.length; i++)
				geometry.faces.push(new THREE.Face3(faces1[i][0], faces1[i][1], faces1[i][2]));
			for (let i=0; i<faces2.length; i++)
				geometry.faces.push(new THREE.Face3(faces2[i][0] + 6, faces2[i][1] + 6, faces2[i][2] + 6));
			const borders = [[0,7,6],[1,8,7],[2,9,8],[3,10,9],[4,11,10],[5,6,11],
				[0,1,7],[1,2,8],[2,3,9],[3,4,10],[4,5,11],[5,0,6]];
			for (let i=0; i<borders.length; i++)
				geometry.faces.push(new THREE.Face3(borders[i][0], borders[i][1], borders[i][2]));
			geometry.computeVertexNormals();
			const stationMaterial = new THREE.MeshPhongMaterial({
				bumpMap: stationBumpTex,
				map: stationDiffuseTex,
				alphaMap: stationOpacityTex,
				emissiveMap: stationSelfIlluminationTex,
			});
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

		function makeTextSprite( message, parameters )
		{
			if ( parameters === undefined ) parameters = {};

			const fontface = parameters.hasOwnProperty("fontface") ?
				parameters["fontface"] : "Arial";

			const fontsize = parameters.hasOwnProperty("fontsize") ?
				parameters["fontsize"] : 36;

			const borderThickness = parameters.hasOwnProperty("borderThickness") ?
				parameters["borderThickness"] : 4;

			const borderColor = parameters.hasOwnProperty("borderColor") ?
				parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };

			const backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
				parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };

			const tmp_canvas = document.createElement('canvas');
			const tmp_context = tmp_canvas.getContext('2d');
			tmp_context.font = "Bold " + fontsize + "px " + fontface;
			const tmp_metrics = tmp_context.measureText(message);
			const textWidth = tmp_metrics.width;

			const canvas = document.createElement('canvas');
			const width = textWidth + borderThickness * 2;
			canvas.width = width;
			const context = canvas.getContext('2d');
			context.font = "Bold " + fontsize + "px " + fontface;

			// background color
			context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
				+ backgroundColor.b + "," + backgroundColor.a + ")";
			// border color
			context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
				+ borderColor.b + "," + borderColor.a + ")";

			context.lineWidth = borderThickness;
			roundRect(context, borderThickness/2, borderThickness/2, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
			// 1.4 is extra height factor for text below baseline: g,j,p,q.

			// text color
			context.fillStyle = "rgba(0, 0, 0, 1.0)";

			context.fillText(message, borderThickness, fontsize + borderThickness * 2);

			// canvas contents will be used for a texture
			const texture = new THREE.Texture(canvas);
			texture.needsUpdate = true;

			const spriteMaterial = new THREE.SpriteMaterial(
				{ map: texture } );
			const sprite = new THREE.Sprite( spriteMaterial );
			sprite.scale.set(0.03*width*0.9,4*0.9,1.0);
			return sprite;
		}

		function roundRect(ctx, x, y, w, h, r)
		{
			ctx.beginPath();
			ctx.moveTo(x+r, y);
			ctx.lineTo(x+w-r, y);
			ctx.quadraticCurveTo(x+w, y, x+w, y+r);
			ctx.lineTo(x+w, y+h-r);
			ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
			ctx.lineTo(x+r, y+h);
			ctx.quadraticCurveTo(x, y+h, x, y+h-r);
			ctx.lineTo(x, y+r);
			ctx.quadraticCurveTo(x, y, x+r, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
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
			const newFov = camera.fov + (event.deltaY * 0.05);
			if(newFov > 60 && newFov < 100)
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
				if(now - a.creationTime < 3 * 1000)
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
			planetGroup.rotateY(delta / 10);

			removeParticleSystemsIfNeeded();
			for (let i = 0; i < _this.arrows.length; i++) {
				const arrow = _this.arrows[i];
				if (delta > 0) {
					options.color = arrow.color.getHex();
					const steps = 3;
					for (let step = 0; step < steps; step++) {
						arrow.timer += delta / 3 / steps;
						options.position = arrow.spline.getPoint(arrow.timer);
						for (let x = 0; x < spawnerOptions.spawnRate * delta / steps; x++) {
							arrow.particleSystem.spawnParticle(options);
						}
					}
				}
				arrow.particleSystem.update(arrow.timer);
			}

			renderer.render(scene, camera);
		}
	}
}