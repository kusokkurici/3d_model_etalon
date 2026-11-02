import * as THREE from 'three';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
const host=document.querySelector('#scene'),status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches,ready=false;
const toggle=document.querySelector('#motion');
function label(){toggle.textContent=paused?'Включить движения':'Приостановить движения';toggle.setAttribute('aria-pressed',String(paused));}label();
toggle.addEventListener('click',()=>{paused=!paused;label();});
try{
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);host.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(1.1,.7,2.0);camera.lookAt(0,.28,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x7d8464,2.5));const light=new THREE.DirectionalLight(0xfff5e5,3);light.position.set(3,5,4);scene.add(light);
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,1,64,64,64);gradient.addColorStop(0,'rgba(30,45,25,.3)');gradient.addColorStop(1,'rgba(30,45,25,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.015;scene.add(shadow);
const pointer=new THREE.Vector2(),smooth=new THREE.Vector2();window.addEventListener('pointermove',e=>{pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);});document.documentElement.addEventListener('pointerleave',()=>pointer.set(0,0));
let mixer,model,head,neck,eyes=[],tails=[],base=new Map(),elapsed=0;
new GLTFLoader().load('./animated_pitbull_dog.glb',g=>{
 model=g.scene;scene.add(model);mixer=new THREE.AnimationMixer(model);const clip=g.animations.find(a=>a.name.startsWith('idle_lay_pose'));if(!clip)throw Error('Лежачая поза не найдена');const action=mixer.clipAction(clip);action.play();mixer.update(0);
 model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true),center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);model.rotation.y=-.35;
 head=model.getObjectByName('Head_85');neck=model.getObjectByName('Neck01_88');eyes=['LeftEye_58','RightEye_82'].map(n=>model.getObjectByName(n));tails=Array.from({length:7},(_,i)=>model.getObjectByName(`Tail0${i+1}_${12-i}`));
 for(const b of [head,neck,...eyes,...tails])if(b)base.set(b,b.quaternion.clone());ready=true;status.hidden=true;
},e=>{if(e.total)status.textContent=`Загружаем друга… ${Math.round(e.loaded/e.total*100)}%`;},()=>{status.textContent='Не удалось загрузить модель. Обновите страницу или проверьте подключение.';});
function resize(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);resize();
const clock=new THREE.Clock(),offset=new THREE.Quaternion();
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);if(ready){for(const [b,q]of base)b.quaternion.copy(q);if(!paused){elapsed+=dt;smooth.lerp(pointer,1-Math.exp(-dt*5));for(const [b,strength]of [[head,.3],[neck,.12],...eyes.map(b=>[b,.1])])if(b){offset.setFromEuler(new THREE.Euler(smooth.y*.18*strength/.3,0,-smooth.x*strength));b.quaternion.multiply(offset);}tails.forEach((b,i)=>{if(b){offset.setFromEuler(new THREE.Euler(0,Math.sin(elapsed*4.5-i*.45)*(.07+i*.012),0));b.quaternion.multiply(offset);}});model.scale.set(1,1+Math.sin(elapsed*1.7)*.004,1);}}renderer.render(scene,camera);});
}catch(error){status.textContent='Для просмотра собаки нужен браузер с поддержкой WebGL.';console.error(error);}
