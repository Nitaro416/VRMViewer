import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {VRMLoaderPlugin} from "@pixiv/three-vrm";
import {createVRMAnimationClip} from "@pixiv/three-vrm-animation";
import {VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy} from "@pixiv/three-vrm-animation";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";

const btnSelect = document.getElementById("selectFolder");
const backBtn = document.getElementById("backBtn");
const canvas = document.querySelector("canvas");
const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");

// ============================================================
// THREE CORE
// ============================================================
let scene;
let camera;
let renderer;
let controls;
let loader;

// ============================================================
// VRM RUNTIME
// ============================================================
let currentVrm = null;
let mixer = null;

// ============================================================
// VRMA ANIMATION SYSTEM
// ============================================================
const vrmaFileMap = new Map();
const vrmaClipMap = new Map();
let currentAction = null;
let idleAction = null;

// ============================================================
// EXPRESSION SYSTEM
// ============================================================
let activeExpression = null;
let expressionCurrent = {};
const EXPRESSION_FADE = 0.15;
const FADE_TIME = 0.3;
const ACTION_DURATION = 3;

// ============================================================
// BLINK SYSTEM
// ============================================================
let blinkTimer = 0;
let nextBlink = randomBlinkInterval();
let blinkState = 0;
let blinkValue = 0;
const BLINK_CLOSE_SPEED = 18;
const BLINK_OPEN_SPEED = 14;

// ============================================================
// EYE SACCADE SYSTEM
// ============================================================
let eyeLookTarget = new THREE.Object3D()
let eyeTimer = 0;
let nextEyeMove = randomEyeTime();
let eyeTarget = new THREE.Vector2(0, 0);
let eyeCurrent = new THREE.Vector2(0, 0);
const EYE_SPEED = 6;
const EYE_RANGE_MIN = 0.03
const EYE_RANGE_MAX = 0.2

// ============================================================
// BREATHING SYSTEM
// ============================================================
let breathingTime = 0;
const BREATH_SPEED_MIN = 0.7
const BREATH_SPEED_MAX = 1.1
const BREATH_AMOUNT_MIN = 0.004
const BREATH_AMOUNT_MAX = 0.012
let breathSpeed =
    BREATH_SPEED_MIN +
    Math.random() * (BREATH_SPEED_MAX - BREATH_SPEED_MIN);
let breathAmount =
    BREATH_AMOUNT_MIN +
    Math.random() * (BREATH_AMOUNT_MAX - BREATH_AMOUNT_MIN);

// ============================================================
// GLOBAL CLOCK
// ============================================================
const clock = new THREE.Timer();

// ============================================================
// FLG
// ============================================================
let isReadyToRender = false;

// ================================
// Folder Access
// ================================
btnSelect.onclick = async () => {
    try {
        const dir = await window.showDirectoryPicker({
            id: "vrm-viewer-folder",
            mode: "read"
        });

        setLoadingState();
        await startFolder(dir);

    } catch (err) {
        handleError(err);
    }
};

// ================================
// Folder Scan And Run
// ================================
async function startFolder(dir) {
    try {
        showProgress();
        setProgress(0.05, "フォルダスキャン");

        let vrmFile = null;
        let vrmaFiles = [];
        let json = null;

        async function scan(d) {
            for await (const [name, handle] of d.entries()) {
                if (handle.kind === "file") {
                    const file = await handle.getFile();
                    if (name.endsWith(".vrm")) vrmFile = file;
                    if (name.endsWith(".vrma")) vrmaFiles.push(file);
                    if (name.endsWith(".json")) json = await loadJSON(file);
                }
                if (handle.kind === "directory") await scan(handle);
            }
        }

        await scan(dir);

        if (!vrmFile) {
            throw new Error("VRMファイルが見つかりません");
        }

        setProgress(0.1, "読み込み開始");

        await run(vrmFile, vrmaFiles, json);

    } catch (err) {
        hideProgress();
        handleError(err);
    }
}

// ================================
// Run
// ================================
async function run(vrmFile, vrmaFiles, jsonFile) {
    try {
        showProgress();

        initScene();
        initCamera();
        initLoader();

        await loadVRM(vrmFile);

        currentVrm.scene.traverse(obj => {
            obj.frustumCulled = false;
        });

        registerVRMA(vrmaFiles);
        await preloadVRMA();

        if (jsonFile && jsonFile[0]?.background) {
            applyBackground(jsonFile[0]?.background);
        }

        if (jsonFile) startSequence(jsonFile);

        renderLoop();

        setTimeout(() => {
            hideProgress();
            canvas.classList.add("visible");
            isReadyToRender = true;
        }, 300);

    } catch (err) {
        hideProgress();
        handleError(err);
    }
}

// ================================
// Scene initialize
// ================================
function initScene() {
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;

    const main = new THREE.DirectionalLight(0xffffff, 2);
    main.position.set(1, 2, 3);
    scene.add(main);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-1, 1, -2);
    scene.add(fill);
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(3, 5, 2);
    light.castShadow = true;
    scene.add(light);
}

// ================================
// Camera initialize
// ================================
function initCamera() {
    camera = new THREE.PerspectiveCamera(
        30,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        20
    );
    camera.position.set(0.5, 2, 3.5);
    camera.lookAt(0, 1, 0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
}

// ================================
// Loader initialize
// ================================
function initLoader() {
    loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.register(parser => new VRMAnimationLoaderPlugin(parser));
}

async function loadVRM(file) {
    if (!file) {
        throw new Error("VRMファイルが見つかりません");
    }

    setProgress(0.1, "VRM読み込み");

    const gltf = await new Promise((res, rej) => {
        loader.load(
            URL.createObjectURL(file),
            res,
            (e) => {
                if (e.total) {
                    setProgress(0.1 + (e.loaded / e.total) * 0.4, "VRM読み込み");
                }
            },
            rej
        );
    });

    if (!gltf.userData.vrm) {
        throw new Error("VRMの解析に失敗しました");
    }

    currentVrm = gltf.userData.vrm;
    scene.add(currentVrm.scene);

    if (currentVrm.lookAt) {
        currentVrm.lookAt.quaternionProxy =
            new VRMLookAtQuaternionProxy(currentVrm.lookAt);
    }

    mixer = new THREE.AnimationMixer(currentVrm.scene);

    scene.add(eyeLookTarget);

    if (currentVrm.lookAt) {
        currentVrm.lookAt.target = eyeLookTarget;
    }

    setProgress(0.5, "VRM完了");
}

function registerVRMA(files) {
    vrmaFileMap.clear();
    for (const f of files) {
        vrmaFileMap.set(f.name, f);
    }
}

async function preloadVRMA() {
    const total = vrmaFileMap.size;
    let count = 0;

    for (const [name, file] of vrmaFileMap) {
        try {
            const gltf = await new Promise((res, rej) => {
                loader.load(
                    URL.createObjectURL(file),
                    res,
                    undefined,
                    rej
                );
            });

            const anim = gltf.userData.vrmAnimations?.[0];
            if (!anim) {
                throw new Error("VRMAアニメーションが見つかりません");
            }

            const clip = createVRMAnimationClip(anim, currentVrm);
            vrmaClipMap.set(name, clip);

        } catch (err) {
            showError(
                "VRMA読み込み失敗",
                `${name}: ${err.message}`
            );
        }

        count++;
        setProgress(0.5 + (count / total) * 0.5, "VRMA読み込み");
    }
}

function returnToIdle() {
    if (!idleAction) return;
    const action = idleAction;
    action.reset();
    action.fadeIn(0.5);
    action.play();
    if (currentAction) {
        currentAction.crossFadeTo(action, 0.5, false);
    }
    currentAction = action;
}

function playVRMA(name) {
    return new Promise(resolve => {
        const clip = vrmaClipMap.get(name);
        if (!clip) {
            resolve();
            return;
        }
        const nextAction = mixer.clipAction(clip);
        nextAction.reset();
        nextAction.setLoop(THREE.LoopOnce);
        nextAction.clampWhenFinished = true;
        nextAction.fadeIn(FADE_TIME);
        nextAction.play();

        if (currentAction) {
            currentAction.crossFadeTo(nextAction, FADE_TIME, false);
        }
        currentAction = nextAction;

        const finished = (e) => {
            if (e.action === nextAction) {
                mixer.removeEventListener("finished", finished);
                resolve();
            }
        };
        mixer.addEventListener("finished", finished);
    });
}

function applyExpressions(action) {
    if (!currentVrm) return;
    const m = currentVrm.expressionManager;
    if (!m) return;
    if (!action.exp) return;
    activeExpression = action.exp;
}

function updateExpression() {
    if (!currentVrm) return;
    const m = currentVrm.expressionManager;
    if (!m) return;
    if (!activeExpression) return;
    for (const name in activeExpression) {
        const target = activeExpression[name];
        const current = expressionCurrent[name] ?? 0;
        const next = THREE.MathUtils.lerp(
            current,
            target,
            EXPRESSION_FADE
        );
        expressionCurrent[name] = next;
        m.setValue(name, next);
    }
}

function resetExpressions() {
    activeExpression = null;
    expressionCurrent = {};
    const m = currentVrm?.expressionManager;
    if (m) m.resetValues();
}

async function startSequence(seq) {
    while (true) {
        const index = Math.floor(Math.random() * seq.length);
        const action = seq[index];
        await playAction(action);
    }
}

async function playAction(action) {
    applyExpressions(action);
    if (action.vrma && action.vrma !== "") {
        await playVRMA(action.vrma);
    } else {
        await sleep(ACTION_DURATION);
    }
    resetExpressions();
    returnToIdle();
}

function renderLoop() {
    function loop() {
        requestAnimationFrame(loop);

        if (!isReadyToRender) return;

        clock.update();
        const delta = clock.getDelta();

        if (mixer) mixer.update(delta);

        if (currentVrm) {
            currentVrm.update(delta);
            updateExpression();
            updateBlink(delta);
            updateEyeSaccade(delta);
            updateBreathing(delta);

            const m = currentVrm.expressionManager;
            if (m) m.update();
        }

        controls.update();
        renderer.render(scene, camera);
    }

    loop();
}

function sleep(sec) {
    return new Promise(r => setTimeout(r, sec * 1000));
}

async function loadJSON(file) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
        throw new Error("JSON root must be array");
    }
    return data;
}

function applyBackground(bg){
    if(!bg || bg === "") return;
    if(typeof bg === "string"){
        scene.background = new THREE.Color(bg);
    }
}

function updateBlink(delta) {
    if (!currentVrm) return;
    const manager = currentVrm.expressionManager;
    if (!manager) return;
    blinkTimer += delta;
    if (blinkState === 0) {
        if (blinkTimer >= nextBlink) {
            blinkTimer = 0;
            nextBlink = randomBlinkInterval();
            blinkState = 1;
        }
    }

    if (blinkState === 1) {
        blinkValue += delta * BLINK_CLOSE_SPEED;
        if (blinkValue >= 1) {
            blinkValue = 1;
            blinkState = 2;
        }

    } else if (blinkState === 2) {
        blinkValue -= delta * BLINK_OPEN_SPEED;
        if (blinkValue <= 0) {
            blinkValue = 0;
            blinkState = 0;
        }
    }
    manager.setValue("blink", blinkValue);
}

function randomEyeTime() {
    return 0.4 + Math.random() * 1.6;
}

function updateEyeSaccade(delta) {
    if (!currentVrm) return
    const lookAt = currentVrm.lookAt
    if (!lookAt) return
    eyeTimer += delta
    if (eyeTimer >= nextEyeMove) {
        eyeTimer = 0
        nextEyeMove = randomEyeTime()
        const range =
            EYE_RANGE_MIN +
            Math.random() * (EYE_RANGE_MAX - EYE_RANGE_MIN)
        eyeTarget.set(
            (Math.random() * 2 - 1) * range,
            (Math.random() * 2 - 1) * range
        )
    }

    eyeCurrent.lerp(eyeTarget, delta * EYE_SPEED)
    eyeLookTarget.position.set(
        eyeCurrent.x,
        1.4 + eyeCurrent.y,
        4
    )
}

function randomBlinkInterval() {
    return 2.0 + Math.random() * 4.0;
}

function updateBreathing(delta) {
    if (!currentVrm) return;
    const humanoid = currentVrm.humanoid;
    if (!humanoid) return;
    const chest =
        humanoid.getNormalizedBoneNode("chest") ||
        humanoid.getNormalizedBoneNode("upperChest");
    if (!chest) return;
    breathingTime += delta * breathSpeed;
    chest.rotation.x = Math.sin(breathingTime * Math.PI * 2) *
        breathAmount;
}

function showError(title, message, timeout = 5000) {
    const container = document.getElementById("error-container");

    const banner = document.createElement("div");
    banner.className = "error-banner";

    banner.innerHTML = `
    <div class="error-banner-icon">⚠</div>
    <div class="error-banner-content">
      <div class="error-banner-title">${title}</div>
      <div class="error-banner-message">${message}</div>
    </div>
    <button class="error-banner-close">&times;</button>
  `;

    // 閉じる処理
    const remove = () => {
        banner.classList.add("removing");
        setTimeout(() => banner.remove(), 200);
    };

    banner.querySelector(".error-banner-close").onclick = remove;

    container.appendChild(banner);

    // 自動削除
    if (timeout > 0) {
        setTimeout(remove, timeout);
    }
}

function setIdleState() {
    btnSelect.style.display = "block";
    backBtn.style.display = "block";
}

function setLoadingState() {
    btnSelect.style.display = "none";
    backBtn.style.display = "none";
}

function resetAppState() {
    // VRM削除
    if (currentVrm) {
        scene?.remove(currentVrm.scene);
        currentVrm = null;
    }

    // Animation
    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }

    currentAction = null;
    idleAction = null;

    // VRMA
    vrmaFileMap.clear();
    vrmaClipMap.clear();

    // Expression
    resetExpressions();

    // Scene破棄（完全リセット）
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }

    scene = null;
    camera = null;
    controls = null;
    loader = null;
}

function handleError(error) {
    console.error(error);

    showError(
        "読み込みエラー",
        error?.message || "不明なエラー"
    );

    resetAppState();
    setIdleState();
}

function setProgress(value, label = "") {
    const percent = Math.floor(value * 100);
    progressFill.style.width = percent + "%";
    progressText.textContent = label
        ? `${label} (${percent}%)`
        : `${percent}%`;
}

function showProgress() {
    progressContainer.classList.remove("hidden");
    setProgress(0);
}

function hideProgress() {
    progressContainer.classList.add("hidden");
}
