import * as THREE from 'three';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';

// The first viewport is the lying pose; one viewport of scroll scrubs stand + turn.
const host = document.querySelector('#scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, .01, 50);
camera.position.set(0, .75, 1.85);
camera.lookAt(0, .38, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x777866, 2.6));
const key = new THREE.DirectionalLight(0xfff1df, 2.8);
key.position.set(-2, 4, 3); scene.add(key);

const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
const ctx = canvas.getContext('2d');
const gradient = ctx.createRadialGradient(64,64,0,64,64,64);
gradient.addColorStop(0,'rgba(36,43,30,.25)'); gradient.addColorStop(1,'rgba(36,43,30,0)');
ctx.fillStyle=gradient; ctx.fillRect(0,0,128,128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.35,1.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));
shadow.rotation.x=-Math.PI/2; shadow.position.y=-.008; scene.add(shadow);

const pointer = new THREE.Vector2(), follow = new THREE.Vector2();
window.addEventListener('pointermove', e => pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2));
document.documentElement.addEventListener('pointerleave', () => pointer.set(0,0));
window.addEventListener('blur', () => pointer.set(0,0));
function resize(){
 const {width,height}=host.getBoundingClientRect();
 renderer.setSize(width,height); camera.aspect=width/height;
 camera.position.set(0,.75,camera.aspect<.7?2.25:1.85);camera.lookAt(0,.38,0);camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host); resize();
let dog, mixer, head, neck, eyes=[], tails=[], actions, elapsed=0, frontYaw=0, smoothProgress=0;
const bounds=new THREE.Box3(), center=new THREE.Vector3();
const parentRotation=new THREE.Quaternion(), worldDelta=new THREE.Quaternion(), localDelta=new THREE.Quaternion();
const axisUp=new THREE.Vector3(0,1,0), axisRight=new THREE.Vector3(1,0,0);
// Convert camera/world-space rotations to each bone's parent space. Bone axes
// are not aligned with screen axes in this imported skeleton.
function rotateWorld(bone, yaw, pitch){
 if(!bone)return;
 bone.parent.getWorldQuaternion(parentRotation);
 worldDelta.setFromAxisAngle(axisUp,yaw).multiply(new THREE.Quaternion().setFromAxisAngle(axisRight,pitch));
 localDelta.copy(parentRotation).invert().multiply(worldDelta).multiply(parentRotation);
 bone.quaternion.premultiply(localDelta); bone.updateMatrixWorld(true);
}
new GLTFLoader().load('./animated_pitbull_dog.glb', gltf => {
 dog=gltf.scene; scene.add(dog); mixer=new THREE.AnimationMixer(dog);
 const get=prefix=>{const clip=gltf.animations.find(a=>a.name.startsWith(prefix));if(!clip)throw Error(`Missing animation: ${prefix}`);return mixer.clipAction(clip);};
 const turnClip=gltf.animations.find(a=>a.name==='idle_turn_180_rgt');
 actions={lay:get('idle_lay_pose'),stand:get('idle_lay_to_idle '),turn:mixer.clipAction(turnClip),turnNext:mixer.clipAction(turnClip.clone())};
 head=dog.getObjectByName('Head_85');neck=dog.getObjectByName('Neck01_88');
 eyes=['LeftEye_58','RightEye_82'].map(n=>dog.getObjectByName(n));
 tails=Array.from({length:7},(_,i)=>dog.getObjectByName(`Tail0${i+1}_${12-i}`));
 pose(actions.lay,0);
 const h=head.getWorldPosition(new THREE.Vector3()), hip=dog.getObjectByName('Hips_115').getWorldPosition(new THREE.Vector3());
 frontYaw=-Math.atan2(h.x-hip.x,h.z-hip.z); dog.rotation.y=frontYaw;
 // Available to automated browser checks without changing the UI.
 window.dogScene={dog,head,tails,actions,renderer};
},undefined,error=>{console.error('Model loading failed',error);host.setAttribute('aria-label','Не удалось загрузить модель собаки');});
function pose(action,time){
 mixer.stopAllAction();action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.setEffectiveWeight(1);action.play();action.time=Math.min(time,action.getClip().duration);mixer.update(0);
}
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{
 const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
 if(dog&&actions){
  const target=THREE.MathUtils.clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight),0,1);
  // Follow scroll without wheel-step jumps, with a speed limit for large jumps.
  // A single unwrapped angle preserves a full revolution in either direction.
  const delta=(target-smoothProgress)*(1-Math.exp(-dt*4));
  smoothProgress+=THREE.MathUtils.clamp(delta,-dt*.28,dt*.28);
  const progress=smoothProgress;
  const standProgress=THREE.MathUtils.smoothstep(progress,.05,.55);
  const turnProgress=THREE.MathUtils.smoothstep(progress,.55,1);
  if(progress<=.05)pose(actions.lay,0);
  else if(progress<=.55)pose(actions.stand,standProgress*actions.stand.getClip().duration);
  else {
   // The source turn is in-place: it animates the stepping, but leaves global
   // heading to the application. Play it twice and blend across the join.
   const phase=turnProgress*2;
   const enter=THREE.MathUtils.smoothstep(phase,0,.12);
   const join=THREE.MathUtils.smoothstep(phase,.9,1);
   mixer.stopAllAction();
   const sample=(action,fraction,weight)=>{
    if(weight<=0)return;
    action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
    action.setEffectiveWeight(weight);action.play();
    action.time=THREE.MathUtils.clamp(fraction,0,1)*action.getClip().duration;
   };
   sample(actions.stand,1,1-enter);
   sample(actions.turn,Math.min(phase,1),enter*(1-join));
   sample(actions.turnNext,Math.max(phase-1,0),enter*join);
   mixer.update(0);
  }
  dog.rotation.y=frontYaw-Math.PI*2*turnProgress;
  camera.lookAt(0,THREE.MathUtils.lerp(.2,.4,standProgress),0);
  dog.position.set(0,0,0);dog.updateMatrixWorld(true);
  bounds.setFromObject(dog,true);bounds.getCenter(center);
  dog.position.set(-center.x,-bounds.min.y,-center.z);dog.updateMatrixWorld(true);
  if(!reduced.matches){
   follow.lerp(pointer,1-Math.exp(-dt*7));
   const weight=1-THREE.MathUtils.smoothstep(progress,.03,.25);
   rotateWorld(neck,follow.x*.18*weight,-follow.y*.12*weight);
   rotateWorld(head,follow.x*.48*weight,-follow.y*.24*weight);
   // Keep the imported eye pose: rotating these eye bones independently
   // exposes the back of the eyeballs at the limits of the cursor range.
   tails.forEach((bone,i)=>rotateWorld(bone,Math.sin(elapsed*4.2-i*.5)*.07*weight,0));
  }
  window.dogScene.progress=progress;
 }
 renderer.render(scene,camera);
});
