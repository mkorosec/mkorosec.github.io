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
    context.fillStyle = '#12344a';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(193, 225, 232, .16)';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 12) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = height / 6; y < height; y += height / 6) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    context.fillStyle = '#6eaa94';
    context.strokeStyle = '#bbd9bd';
    context.lineWidth = 1.4;
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
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 80, 48), new THREE.MeshPhongMaterial({map: texture, shininess: 10}));
    globe.add(sphere);
    const markers = new THREE.Group();
    globe.add(markers);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunlight.position.set(-3, 5, 8);
    scene.add(sunlight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let active = false;
    let frame = 0;
    let down = null;
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
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
    }
    renderer.domElement.addEventListener('pointerdown', event => {
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
        while (markers.children.length) {
            const object = markers.children[0];
            markers.remove(object);
            object.geometry.dispose();
            object.material.dispose();
        }
    }
    function addPin(point, color) {
        const pin = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), new THREE.MeshBasicMaterial({color}));
        pin.position.copy(globePoint(point.lat, point.lng, 2.06));
        markers.add(pin);
    }
    return {
        show() { if (active) return; container.hidden = false; active = true; resize(); render(); },
        hide() { active = false; cancelAnimationFrame(frame); container.hidden = true; },
        nudge(dx, dy) { globe.rotation.y += dx; globe.rotation.x = Math.max(-1.35, Math.min(1.35, globe.rotation.x + dy)); },
        selectHovered() {
            const rect = renderer.domElement.getBoundingClientRect();
            const center = coordinates({clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2});
            if (center) onGuess(center.lat, center.lng);
        },
        setMarkers(guess, answer) {
            clearMarkers();
            if (guess) addPin(guess, 0x60a5fa);
            if (answer) addPin(answer, 0x4ade80);
            if (guess && answer) {
                const start = globePoint(guess.lat, guess.lng, 2.07).normalize();
                const end = globePoint(answer.lat, answer.lng, 2.07).normalize();
                const points = [];
                for (let i = 0; i <= 60; i++) {
                    const vector = start.clone().lerp(end, i / 60).normalize().multiplyScalar(2.055);
                    points.push(vector);
                }
                markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: 0xfbd38d, transparent: true, opacity: .85})));
            }
        },
        focus(lat, lng) {
            globe.rotation.y = -Math.PI / 2 - lng * Math.PI / 180;
            globe.rotation.x = Math.max(-1.2, Math.min(1.2, lat * Math.PI / 180));
        }
    };
}
