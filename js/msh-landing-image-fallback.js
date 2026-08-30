/* My Simple Health — resilient landing showcase image */
(function () {
  'use strict';

  const image = document.querySelector('.landing-health-life-showcase img');
  if (!image) return;

  const repoFallback = 'https://raw.githubusercontent.com/sieannasmith-health/my-simple-health/main/assets/images/landing-health-life-showcase.webp';
  const isVercelDeployment = /\.vercel\.app$/i.test(window.location.hostname);
  let usingFallback = false;

  function showFallback() {
    if (usingFallback || image.src === repoFallback) return;
    usingFallback = true;
    image.dataset.assetFallback = 'github';
    image.src = repoFallback;
  }

  image.addEventListener('error', showFallback, { once: true });

  /* Protected Vercel preview/transition URLs can return an auth redirect for
     static image subrequests even when the HTML document itself is visible.
     Use the public repository copy on those temporary hosts. */
  if (isVercelDeployment) {
    showFallback();
    return;
  }

  /* If a browser stalls on a redirected/non-image response instead of firing
     an immediate error, recover without leaving a large broken-image gap. */
  window.setTimeout(function () {
    if (!image.complete || image.naturalWidth === 0) showFallback();
  }, 1200);
}());
