import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/msh-homepage.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../js/msh-homepage.js', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255).map(value =>
    value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  );
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + .05) / (low + .05);
}

test('homepage communicates the journey rather than a feature collection', () => {
  assert.match(html, /Your health\.\s*<br>Made simpler\./);
  assert.match(html, /Understand where you are/);
  assert.match(html, /See your way forward/);
  assert.doesNotMatch(html, /home-tool-card|What would you like to explore\?/);
});

test('six connected journey stages appear in the required order', () => {
  const stages = Array.from(html.matchAll(/data-stage="([^"]+)"/g), match => match[1]);
  assert.deepEqual(stages, ['landscape', 'horizon', 'path', 'practice', 'discovery', 'journey']);
  for (const number of ['01', '02', '03', '04', '05', '06']) assert.match(html, new RegExp(`>${number}<`));
});

test('journey destinations and persistent Hello access use real application routes', () => {
  for (const destination of [
    'my-landscape.html', 'my-vision.html', 'my-project.html',
    'my-practice.html', 'my-learning.html', 'my-progress.html',
    'my-health.html', 'hello.html?from=home'
  ]) assert.match(html, new RegExp(`href="${destination.replace('?', '\\?')}"`));
  assert.match(html, /class="home-hello-companion"/);
});

test('My Health preview uses real architecture and avoids fabricated scoring', () => {
  assert.match(html, /WHERE I AM[\s\S]*Landscape/);
  assert.match(html, /DIRECTION[\s\S]*Vision/);
  assert.match(html, /WHAT MATTERS NOW[\s\S]*Project \+ Practice/);
  assert.match(html, /WHAT I'M LEARNING[\s\S]*Discovery/);
  assert.match(html, /WHAT HAS CHANGED[\s\S]*Progress/);
  assert.doesNotMatch(html, /overall wellness|wellness percentage|optimization score|fake biometric/i);
});

test('desktop progression is scroll-linked without wheel interception', () => {
  assert.match(css, /\.home-journey\s*\{[^}]*height:520vh/);
  assert.match(css, /\.home-journey-sticky\s*\{[^}]*position:sticky/);
  assert.match(script, /translate3d/);
  assert.match(script, /requestAnimationFrame/);
  assert.doesNotMatch(script, /addEventListener\(['"]wheel|preventDefault\(\).*wheel/s);
});

test('mobile journey uses native horizontal scrolling and partial-card focus', () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*scroll-snap-type:x mandatory/);
  assert.match(css, /width:min\(82vw,390px\)/);
  assert.match(script, /scrollIntoView/);
});

test('journey remains keyboard-operable and semantically navigable', () => {
  assert.match(html, /tabindex="0"[^>]*data-journey-card/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /home-skip-link/);
});

test('reduced motion removes scroll-linked staging while preserving content', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.home-journey\s*\{ height:auto/);
  assert.match(css, /\.home-journey-sticky\s*\{ position:relative/);
  assert.match(script, /prefers-reduced-motion: reduce/);
});

test('homepage uses isolated lightweight assets and shared theme runtime', () => {
  assert.match(html, /js\/msh-theme\.js/);
  assert.match(html, /css\/msh-homepage\.css/);
  assert.match(html, /js\/msh-homepage\.js/);
  assert.doesNotMatch(html, /cdnjs|font-awesome|hero-home\.png|<video|three\.js|gsap/i);
  assert.match(css, /hero-journey-landscape\.jpg/);
  assert.match(css, /journey-landscape-background\.jpg/);
  assert.match(css, /homepage-botanical-atmosphere\.png/);
  assert.match(css, /\[data-theme="dark"\]/);
});

test('approved visual system uses editorial cards, restrained accents, and a warm landscape', () => {
  assert.match(css, /--home-gold:#caa76b/);
  assert.match(css, /--home-clay:#a56f59/);
  assert.match(css, /--home-blue-gray:#71868a/);
  assert.match(css, /\.home-world-atmosphere[^}]*hero-journey-landscape\.jpg/);
  assert.match(css, /\.home-journey-card[^}]*width:clamp\(300px,22vw,340px\)/);
  assert.match(css, /\.home-journey-card[^}]*min-height:540px/);
  assert.match(css, /\.home-journey-path-line[^}]*repeating-linear-gradient/);
  assert.match(css, /\.home-hello-band::before/);
  assert.match(css, /\.home-health-map::before/);
});

test('journey cards form a six-frame naturalist illustration sequence', () => {
  assert.equal((html.match(/class="home-card-story"/g) || []).length, 6);
  assert.equal((html.match(/class="story-frame"/g) || []).length, 6);
  assert.match(html, /data-stage="landscape"[\s\S]*story-far/);
  assert.match(html, /data-stage="horizon"[\s\S]*story-sun/);
  assert.match(html, /data-stage="path"[\s\S]*story-route/);
  assert.match(html, /data-stage="practice"[\s\S]*story-leaf[\s\S]*story-hand/);
  assert.match(html, /data-stage="discovery"[\s\S]*story-reveal/);
  assert.match(html, /data-stage="journey"[\s\S]*story-route/);
  assert.doesNotMatch(html, /assets\/images\/journey\//);
});

test('expanded story content belongs only to the active or focused card', () => {
  assert.equal((html.match(/class="home-card-detail"/g) || []).length, 6);
  assert.equal((html.match(/What you'll explore/g) || []).length, 6);
  assert.equal((html.match(/You'll leave with/g) || []).length, 6);
  assert.match(css, /\.home-card-detail\s*\{[^}]*max-height:0[^}]*opacity:0/);
  assert.match(css, /\.home-journey-card\.is-active \.home-card-detail/);
  assert.doesNotMatch(css, /@media \(max-width: 600px\)[\s\S]*\.home-card-detail\s*\{[^}]*opacity:1/);
});

test('stage-specific illustration motion and progress points remain restrained', () => {
  assert.match(css, /\.story-sun[^}]*translateY\(5px\)/);
  assert.match(css, /\.story-route[^}]*stroke-dasharray:82/);
  assert.match(css, /\.story-leaf-left/);
  assert.match(css, /\.story-reveal[^}]*opacity:\.58/);
  assert.equal((html.match(/<i><\/i>/g) || []).length, 6);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /bounce|confetti|@keyframes/i);
});

test('Hello remains a companion rather than becoming journey stage 07', () => {
  assert.equal((html.match(/data-journey-card/g) || []).length, 6);
  assert.doesNotMatch(html, /data-stage="hello"|>07</);
  assert.match(html, /class="home-hello-band/);
  assert.match(html, /class="home-hello-companion"/);
});

test('core homepage text pairs meet WCAG AA contrast in light and dark themes', () => {
  assert.ok(contrast('#253129', '#faf8f1') >= 4.5);
  assert.ok(contrast('#667168', '#faf8f1') >= 4.5);
  assert.ok(contrast('#f2eee3', '#122019') >= 4.5);
  assert.ok(contrast('#eeeade', '#1d2c25') >= 4.5);
});
