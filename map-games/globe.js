import * as THREE from './dist/three.module.js';

export function globePoint(lat, lng, radius = 2.025) {
    const latitude = lat * Math.PI / 180;
    const longitude = lng * Math.PI / 180;
    return new THREE.Vector3(
        radius * Math.cos(latitude) * Math.cos(longitude),
        radius * Math.sin(latitude),
        -radius * Math.cos(latitude) * Math.sin(longitude)
    );
}

export function globeCoordinates(point) {
    const local = point.clone().normalize();
    return {lat: Math.asin(local.y) * 180 / Math.PI, lng: Math.atan2(-local.z, local.x) * 180 / Math.PI};
}

export function globeArcPoints(guess, answer, segments = 90) {
    const start = globePoint(guess.lat, guess.lng).normalize();
    const end = globePoint(answer.lat, answer.lng).normalize();
    const dot = THREE.MathUtils.clamp(start.dot(end), -1, 1);
    const angle = Math.acos(dot);
    const tangent = end.clone().addScaledVector(start, -dot);
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0).cross(start);
    if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0).cross(start);
    tangent.normalize();
    return Array.from({length: segments + 1}, (_, index) => {
        const progress = index / segments;
        return start.clone().multiplyScalar(Math.cos(angle * progress))
            .addScaledVector(tangent, Math.sin(angle * progress))
            .multiplyScalar(2.065 + .13 * Math.sin(Math.PI * progress));
    });
}

function pinTexture(color, symbol) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 176;
    const context = canvas.getContext('2d');
    context.shadowColor = 'rgba(0, 0, 0, .45)';
    context.shadowBlur = 14;
    context.shadowOffsetY = 7;
    context.beginPath();
    context.moveTo(64, 166);
    context.bezierCurveTo(46, 129, 19, 112, 19, 69);
    context.bezierCurveTo(19, 42, 39, 20, 64, 20);
    context.bezierCurveTo(89, 20, 109, 42, 109, 69);
    context.bezierCurveTo(109, 112, 82, 129, 64, 166);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.shadowColor = 'transparent';
    context.lineWidth = 7;
    context.strokeStyle = '#e9f7ef';
    context.stroke();
    context.beginPath();
    context.arc(64, 69, 29, 0, Math.PI * 2);
    context.fillStyle = '#113044';
    context.fill();
    context.strokeStyle = '#e9f7ef';
    context.lineWidth = 4;
    context.stroke();
    context.strokeStyle = '#e9f7ef';
    context.lineWidth = 7;
    context.lineCap = 'round';
    context.beginPath();
    if (symbol === 'target') {
        context.arc(64, 69, 12, 0, Math.PI * 2);
        context.moveTo(64, 43); context.lineTo(64, 49);
        context.moveTo(64, 89); context.lineTo(64, 95);
        context.moveTo(38, 69); context.lineTo(44, 69);
        context.moveTo(84, 69); context.lineTo(90, 69);
    } else {
        context.arc(64, 69, 9, 0, Math.PI * 2);
    }
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export async function createGlobe(container, onGuess) {
    const response = await fetch('./dist/countries.json');
    if (!response.ok) throw new Error('Country outlines could not be loaded');
    const countries = await response.json();
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2048;
    textureCanvas.height = 1024;
    const context = textureCanvas.getContext('2d');
    const width = textureCanvas.width;
    const height = textureCanvas.height;
    const ocean = context.createLinearGradient(0, 0, 0, height);
    ocean.addColorStop(0, '#0a293e');
    ocean.addColorStop(.5, '#164a5e');
    ocean.addColorStop(1, '#09283e');
    context.fillStyle = ocean;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(180, 219, 224, .12)';
    context.lineWidth = 1;
    context.setLineDash([3, 7]);
    for (let x = 0; x <= width; x += width / 12) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = height / 6; y < height; y += height / 6) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    context.setLineDash([]);

    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = patternCanvas.height = 512;
    const patternContext = patternCanvas.getContext('2d');
    const pattern = patternContext.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const noise = ((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0;
            const relief = 7 * Math.sin(x * .037) * Math.cos(y * .031) + (noise % 15) - 7;
            const offset = (y * 512 + x) * 4;
            pattern.data[offset] = 110 + relief;
            pattern.data[offset + 1] = 168 + relief;
            pattern.data[offset + 2] = 146 + relief;
            pattern.data[offset + 3] = 255;
        }
    }
    patternContext.putImageData(pattern, 0, 0);
    context.fillStyle = context.createPattern(patternCanvas, 'repeat');
    context.strokeStyle = 'rgba(220, 245, 213, .72)';
    context.lineWidth = 1.1;
    for (const feature of countries.features) {
        const geometry = feature.geometry;
        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        for (const polygon of polygons) {
            for (const shift of [-width, 0, width]) {
                context.beginPath();
                for (const ring of polygon) {
                    let previousX;
                    let wrap = 0;
                    ring.forEach(([longitude, latitude], index) => {
                        const rawX = (longitude + 180) / 360 * width;
                        if (previousX !== undefined && rawX + wrap - previousX > width / 2) wrap -= width;
                        if (previousX !== undefined && rawX + wrap - previousX < -width / 2) wrap += width;
                        const x = rawX + wrap;
                        const y = (90 - latitude) / 180 * height;
                        if (index === 0) context.moveTo(x + shift, y);
                        else context.lineTo(x + shift, y);
                        previousX = x;
                    });
                    context.closePath();
                }
                context.fill('evenodd');
                context.stroke();
            }
        }
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 7;
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '3D globe. Arrow keys rotate, Enter guesses the location at the center.');
    container.appendChild(renderer.domElement);
    const globe = new THREE.Group();
    globe.rotation.set(20 * Math.PI / 180, -Math.PI / 2, 0);
    scene.add(globe);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 80, 48), new THREE.MeshPhongMaterial({map: texture, shininess: 18, specular: 0x315c6a}));
    globe.add(sphere);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.095, 64, 48), new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {glowColor: {value: new THREE.Color('#7ed8d1')}},
        vertexShader: `varying vec3 vNormal; varying vec3 vView;
            void main() {
                vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                vNormal = normalize(normalMatrix * normal);
                vView = normalize(-viewPosition.xyz);
                gl_Position = projectionMatrix * viewPosition;
            }`,
        fragmentShader: `uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vView;
            void main() {
                float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.0);
                gl_FragColor = vec4(glowColor, rim * 0.46);
            }`
    }));
    scene.add(atmosphere);
    const stars = new Float32Array(450 * 3);
    let seed = 1234567;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let index = 0; index < stars.length; index += 3) {
        stars[index] = (random() - .5) * 32;
        stars[index + 1] = (random() - .5) * 20;
        stars[index + 2] = -8 - random() * 16;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({color: 0x92bdcc, size: .07, transparent: true, opacity: .56, depthWrite: false})));
    const markers = new THREE.Group();
    globe.add(markers);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sunlight = new THREE.DirectionalLight(0xffffff, 1.65);
    sunlight.position.set(-3, 5, 8);
    scene.add(sunlight);
    const guessPinTexture = pinTexture('#5aa9f4', 'guess');
    const answerPinTexture = pinTexture('#4ad986', 'target');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let active = false;
    let frame = 0;
    let down = null;
    let reveal = null;
    let focusAnimation = null;
    function coordinates(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(sphere)[0];
        if (!hit) return null;
        return globeCoordinates(globe.worldToLocal(hit.point.clone()));
    }
    function resize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        camera.position.z = Math.max(camera.position.z, 2.5 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
        renderer.setSize(width, height);
    }
    function render() {
        if (!active) return;
        if (focusAnimation) {
            const progress = Math.min(1, (performance.now() - focusAnimation.started) / 900);
            const eased = 1 - Math.pow(1 - progress, 3);
            globe.rotation.x = focusAnimation.fromX + (focusAnimation.toX - focusAnimation.fromX) * eased;
            globe.rotation.y = focusAnimation.fromY + focusAnimation.deltaY * eased;
            if (progress === 1) focusAnimation = null;
        }
        if (reveal) {
            const progress = Math.min(1, (performance.now() - reveal.started) / 1250);
            const indices = reveal.path.geometry.index.count;
            reveal.path.geometry.setDrawRange(0, Math.floor(indices * progress / 6) * 6);
            reveal.tracer.position.copy(reveal.curve.getPointAt(progress));
            reveal.tracer.visible = progress < 1;
            reveal.ring.scale.setScalar(progress < 1 ? 1 + progress * 1.6 : 1);
            reveal.ring.material.opacity = progress < 1 ? .72 * (1 - progress) : .58;
            if (progress === 1) reveal = null;
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
    }
    renderer.domElement.addEventListener('pointerdown', event => {
        focusAnimation = null;
        down = {x: event.clientX, y: event.clientY, rotationX: globe.rotation.x, rotationY: globe.rotation.y, moved: false};
        renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', event => {
        if (down) {
            const dx = event.clientX - down.x;
            const dy = event.clientY - down.y;
            if (Math.hypot(dx, dy) > 5) down.moved = true;
            if (down.moved) {
                globe.rotation.y = down.rotationY + dx * .005;
                globe.rotation.x = Math.max(-1.35, Math.min(1.35, down.rotationX + dy * .005));
            }
        }
        hovered = coordinates(event);
        renderer.domElement.style.cursor = down?.moved ? 'grabbing' : hovered ? 'crosshair' : 'grab';
    });
    renderer.domElement.addEventListener('pointerup', event => {
        if (down && !down.moved) {
            const point = coordinates(event);
            if (point) onGuess(point.lat, point.lng);
        }
        down = null;
    });
    renderer.domElement.addEventListener('pointercancel', () => { down = null; });
    renderer.domElement.addEventListener('wheel', event => {
        event.preventDefault();
        const fitDistance = 2.5 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
        camera.position.z = Math.max(Math.max(3.2, fitDistance * .82), Math.min(Math.max(9, fitDistance + 6), camera.position.z + Math.sign(event.deltaY) * .35));
    }, {passive: false});
    new ResizeObserver(resize).observe(container);

    function clearMarkers() {
        reveal = null;
        while (markers.children.length) {
            const object = markers.children[0];
            markers.remove(object);
            if (!object.isSprite) object.geometry.dispose();
            object.material.dispose();
        }
    }
    function addPin(point, texture, color) {
        const normal = globePoint(point.lat, point.lng).normalize();
        const ring = new THREE.Mesh(new THREE.RingGeometry(.052, .066, 48), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .58, depthWrite: false, side: THREE.DoubleSide}));
        ring.position.copy(normal).multiplyScalar(2.023);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        markers.add(ring);
        const pin = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false}));
        pin.center.set(.5, 0);
        pin.scale.set(.13, .18, 1);
        pin.position.copy(normal).multiplyScalar(2.055);
        markers.add(pin);
        return ring;
    }
    return {
        show() { if (active) return; container.hidden = false; active = true; resize(); render(); },
        hide() { active = false; cancelAnimationFrame(frame); container.hidden = true; },
        nudge(dx, dy) { focusAnimation = null; globe.rotation.y += dx; globe.rotation.x = Math.max(-1.35, Math.min(1.35, globe.rotation.x + dy)); },
        selectHovered() {
            const rect = renderer.domElement.getBoundingClientRect();
            const center = coordinates({clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2});
            if (center) onGuess(center.lat, center.lng);
        },
        setMarkers(guess, answer) {
            clearMarkers();
            if (guess) addPin(guess, guessPinTexture, 0x78bcff);
            const answerRing = answer && addPin(answer, answerPinTexture, 0x83e6a2);
            if (guess && answer) {
                const curve = new THREE.CatmullRomCurve3(globeArcPoints(guess, answer));
                const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, .008, 6, false), new THREE.MeshBasicMaterial({color: 0xf5d48b, transparent: true, opacity: .85}));
                markers.add(path);
                if (!reducedMotion) {
                    path.geometry.setDrawRange(0, 0);
                    const tracer = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8), new THREE.MeshBasicMaterial({color: 0xfff2bd}));
                    tracer.position.copy(curve.getPointAt(0));
                    markers.add(tracer);
                    reveal = {path, tracer, curve, ring: answerRing, started: performance.now()};
                }
            }
        },
        focus(lat, lng) {
            const toY = -Math.PI / 2 - lng * Math.PI / 180;
            const toX = Math.max(-1.2, Math.min(1.2, lat * Math.PI / 180));
            const deltaY = Math.atan2(Math.sin(toY - globe.rotation.y), Math.cos(toY - globe.rotation.y));
            if (reducedMotion) {
                globe.rotation.set(toX, globe.rotation.y + deltaY, 0);
            } else {
                focusAnimation = {fromX: globe.rotation.x, fromY: globe.rotation.y, toX, deltaY, started: performance.now()};
            }
        }
    };
}
