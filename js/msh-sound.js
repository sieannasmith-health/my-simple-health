/* My Simple Health — optional, user-enabled environmental sound controller */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'msh_sensory_preferences_v1';
  const DEFAULTS = Object.freeze({ soundEnabled:false, volume:.18 });
  const TRACKS = Object.freeze({
    morning:'assets/audio/morning-birds.webm',
    evening:'assets/audio/evening-crickets.webm',
    night:'assets/audio/night-ambient.webm'
  });
  const listeners = new Set();
  let audio = null;
  let activeTrack = null;
  let fadeFrame = 0;

  function clampVolume(value) { const number=Number(value); return Number.isFinite(number) ? Math.max(0,Math.min(.5,number)) : DEFAULTS.volume; }
  function read() {
    try { const value=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}'); return { soundEnabled:value.soundEnabled===true, volume:clampVolume(value.volume) }; }
    catch (_) { return { ...DEFAULTS }; }
  }
  function write(next) { try { root.localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); } catch (_) {} }
  function suggestedTrack() {
    const suggestion=root.MSHEnvironment && root.MSHEnvironment.getCurrent().ambience.suggested;
    return TRACKS[suggestion] || null;
  }
  function notify() { const state=getState(); listeners.forEach(listener=>listener(state)); return state; }
  function ensureAudio() {
    if (audio || typeof root.Audio !== 'function') return audio;
    audio=new root.Audio(); audio.loop=true; audio.preload='none'; audio.setAttribute('aria-hidden','true');
    audio.addEventListener('error',()=>notify());
    return audio;
  }
  function fadeTo(target, duration) {
    if (!audio) return;
    if (fadeFrame) root.cancelAnimationFrame(fadeFrame);
    const start=audio.volume, started=Date.now(), length=Math.max(120,duration||900);
    const step=()=>{const ratio=Math.min(1,(Date.now()-started)/length);audio.volume=start+(target-start)*ratio;if(ratio<1)fadeFrame=root.requestAnimationFrame(step);else fadeFrame=0;};
    fadeFrame=root.requestAnimationFrame(step);
  }
  async function refreshEnvironment() {
    const preference=read();
    if (!preference.soundEnabled || root.document?.hidden) { if(audio) fadeTo(0,360); return notify(); }
    const nextTrack=suggestedTrack();
    if (!nextTrack) { if(audio) fadeTo(0,520); activeTrack=null; return notify(); }
    const player=ensureAudio(); if(!player)return notify();
    if(activeTrack!==nextTrack){fadeTo(0,320);activeTrack=nextTrack;player.src=nextTrack;player.load();}
    try { player.volume=0; await player.play(); fadeTo(preference.volume,900); } catch (_) { /* Browser permission or absent reviewed asset: remain silent. */ }
    return notify();
  }
  async function enable() { const next={...read(),soundEnabled:true};write(next);await refreshEnvironment();return notify(); }
  function disable() { const next={...read(),soundEnabled:false};write(next);if(audio)fadeTo(0,260);return notify(); }
  function toggle() { return read().soundEnabled?disable():enable(); }
  function setVolume(value) { const next={...read(),volume:clampVolume(value)};write(next);if(audio&&next.soundEnabled)fadeTo(next.volume,180);return notify(); }
  function getState() { const preference=read();return{...preference,track:activeTrack,available:Boolean(suggestedTrack()),playing:Boolean(audio&&!audio.paused&&audio.volume>0)}; }
  function onChange(listener){if(typeof listener!=='function')return()=>{};listeners.add(listener);return()=>listeners.delete(listener);}
  function mountControl(){
    const button=root.document?.querySelector('[data-msh-sound-toggle]');if(!button)return;
    const sync=()=>{const state=getState();button.setAttribute('aria-pressed',String(state.soundEnabled));button.setAttribute('aria-label',state.soundEnabled?'Sound on. Turn environmental sound off':'Sound off. Turn environmental sound on');button.title=state.soundEnabled?'Sound on':'Sound off';button.querySelector('[data-msh-sound-label]')?.replaceChildren(state.soundEnabled?'Sound on':'Sound off');};
    button.addEventListener('click',()=>{toggle();sync();});onChange(sync);sync();
  }
  if(root.document){root.document.addEventListener('msh:environment-change',refreshEnvironment);root.document.addEventListener('visibilitychange',refreshEnvironment);root.document.addEventListener('DOMContentLoaded',mountControl,{once:true});}
  root.MSHSound=Object.freeze({ STORAGE_KEY, TRACKS, enable, disable, toggle, setVolume, getState, refreshEnvironment, onChange, mountControl });
})(typeof window !== 'undefined' ? window : globalThis);
