const state = {
  musicEnabled: true,
  musicVolume: 0.7,
  muted: false,
  audio: null,
  audioError: '',
  userHasManuallyPaused: false,
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};
let audioControlsInitialized = false;
let autoplayInitiated = false;
let homeSceneCleanup = null;
let editorialCollageCleanup = null;
let navigationController = null;
let homeAnimationLoader = null;

const pageRoutes = new Set(['index.html', 'memories.html', 'jar.html', 'letter.html', 'finale.html']);

function setLocalValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Storage unavailable', error);
  }
}

function getLocalValue(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

function ensureAudio() {
  if (!state.audio) {
    const audio = document.createElement('audio');
    audio.src = './src/aud/Happy-Birthday-lofi_007_128k.mp3';
    audio.loop = true;
    audio.preload = 'auto';
    audio.autoplay = true;
    audio.volume = state.musicVolume;
    audio.hidden = true;
    audio.addEventListener('error', () => {
      state.audioError = 'Musik tidak dapat dimuat. Periksa berkas musik lalu muat ulang halaman.';
      syncAudioUi();
    });
    audio.addEventListener('play', () => {
      state.musicEnabled = true;
      state.audioError = '';
      syncAudioUi();
    });
    audio.addEventListener('pause', () => {
      state.musicEnabled = false;
      syncAudioUi();
    });
    audio.addEventListener('volumechange', syncAudioUi);
    document.body.append(audio);
    state.audio = audio;
  }

  return state.audio;
}

function updateVolumeUi() {
  document.querySelectorAll('.volume-slider').forEach((slider) => {
    slider.value = String(Math.round(state.musicVolume * 100));
  });

  const muteButton = document.querySelector('[data-mute-toggle]');
  if (muteButton) {
    muteButton.setAttribute('aria-pressed', String(state.muted));
    muteButton.classList.toggle('muted', state.muted);
  }
}

function syncAudioUi() {
  const audio = state.audio;
  state.musicEnabled = Boolean(audio && !audio.paused);
  state.muted = Boolean(audio && audio.muted);
  const toggleButton = document.querySelector('[data-audio-toggle]');
  if (toggleButton) {
    const isPlaying = state.musicEnabled;
    toggleButton.setAttribute('aria-pressed', String(isPlaying));
    toggleButton.setAttribute('aria-label', isPlaying ? 'Jeda musik' : 'Putar musik');
    toggleButton.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z" fill="currentColor" /></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7.5v9l9 4.5V3L7 7.5Z" fill="currentColor" /></svg>';
  }

  document.querySelectorAll('[data-mute-toggle]').forEach((muteButton) => {
    muteButton.setAttribute('aria-label', state.muted ? 'Nyalakan suara' : 'Bisukan suara');
    muteButton.setAttribute('aria-pressed', String(state.muted));
    muteButton.classList.toggle('muted', state.muted);
    muteButton.innerHTML = state.muted
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10l5 3V4l-5 3Zm8 4.5 2.5 2.5-2.5 2.5M17 12h3.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12a4 4 0 0 1-4-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3a4 4 0 0 1 4-4Zm6.5 5.5 2.5 2.5-2.5 2.5M17 12h2.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
  });

  const status = state.audioError ? 'Pemutaran terhalang' : (
    state.musicEnabled ? (state.muted ? 'Dibisukan' : 'Sedang diputar') : 'Siap diputar'
  );
  const statusDescription = state.audioError || (
    state.musicEnabled
      ? (state.muted ? 'Musik sedang diputar tanpa suara.' : 'Musik sedang diputar.')
      : (state.userHasManuallyPaused ? 'Musik dijeda. Tekan Putar untuk melanjutkan.' : 'Musik siap diputar · ketuk layar untuk mendengarkan')
  );
  document.querySelectorAll('.audio-status').forEach((item) => {
    item.textContent = status;
    item.title = statusDescription;
    item.setAttribute('aria-label', statusDescription);
  });
  document.querySelectorAll('.audio-panel').forEach((panel) => {
    panel.classList.toggle('audio-blocked', Boolean(state.audioError));
  });

  updateVolumeUi();
}

async function tryAutoPlayMusic() {
  if (autoplayInitiated) return;
  autoplayInitiated = true;

  const audio = ensureAudio();
  audio.volume = state.musicVolume;
  audio.muted = state.muted;

  try {
    await audio.play();
    state.audioError = '';
    syncAudioUi();
  } catch (error) {
    // Browser autoplay policy restricted audio until user interaction
    const unlockPlayback = async () => {
      ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'].forEach((event) => {
        window.removeEventListener(event, unlockPlayback, true);
      });
      if (audio.paused && !state.userHasManuallyPaused) {
        try {
          await audio.play();
          state.audioError = '';
          syncAudioUi();
        } catch (playErr) {
          console.warn('Playback on interaction failed:', playErr);
        }
      }
    };

    ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'].forEach((event) => {
      window.addEventListener(event, unlockPlayback, { once: true, capture: true, passive: true });
    });
  }
}

async function toggleMusic() {
  const audio = ensureAudio();
  if (!audio.paused) {
    audio.pause();
    state.userHasManuallyPaused = true;
    setLocalValue('uti23MusicPlaying', false);
    return;
  }

  try {
    state.userHasManuallyPaused = false;
    audio.volume = state.musicVolume;
    audio.muted = state.muted;
    await audio.play();
    state.audioError = '';
    setLocalValue('uti23MusicPlaying', true);
    syncAudioUi();
  } catch (error) {
    console.warn('Music playback blocked until user interaction', error);
    state.audioError = 'Peramban memblokir musik. Tekan Putar untuk mencoba lagi.';
    syncAudioUi();
  }
}

function setMuteState(muted) {
  const audio = ensureAudio();
  state.muted = muted;
  audio.muted = muted;
  syncAudioUi();
}

function initMusicControls() {
  const audio = ensureAudio();
  if (!audioControlsInitialized) {
    state.musicVolume = getLocalValue('uti23MusicVolume', 0.7);
    audio.volume = state.musicVolume;

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a') : null;
      if (!target) return;
      if (target.matches('[data-enter-audio]')) {
        if (state.audio.paused) toggleMusic();
      } else if (target.matches('[data-audio-toggle]')) {
        toggleMusic();
      } else if (target.matches('[data-mute-toggle]')) {
        setMuteState(!state.muted);
      } else if (target.matches('[data-replay-music]')) {
        replayMusic();
      }
    });

    document.addEventListener('input', (event) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.matches('.volume-slider')) return;
      const nextVolume = Number(event.target.value) / 100;
      state.musicVolume = nextVolume;
      audio.volume = nextVolume;
      if (nextVolume === 0) audio.muted = true;
      else if (state.muted) audio.muted = false;
      setLocalValue('uti23MusicVolume', nextVolume);
      syncAudioUi();
    });

    audioControlsInitialized = true;
  }

  syncAudioUi();
  tryAutoPlayMusic();
}

async function replayMusic() {
  const audio = ensureAudio();
  try {
    state.userHasManuallyPaused = false;
    audio.currentTime = 0;
    audio.volume = state.musicVolume;
    audio.muted = state.muted;
    await audio.play();
    state.audioError = '';
    setLocalValue('uti23MusicPlaying', true);
    syncAudioUi();
  } catch (error) {
    console.warn('Music playback blocked until user interaction', error);
    state.audioError = 'Peramban memblokir musik. Tekan Putar untuk mencoba lagi.';
    syncAudioUi();
  }
}

function initRevealAnimations() {
  const revealItems = document.querySelectorAll('[data-reveal]');
  if (!revealItems.length || !window.gsap || !window.ScrollTrigger) {
    revealItems.forEach((item) => {
      item.style.opacity = '1';
      item.removeAttribute('data-reveal');
    });
    return;
  }

  const reduceMotion = state.reduceMotion;
  if (reduceMotion) {
    revealItems.forEach((item) => {
      item.style.opacity = '1';
      item.removeAttribute('data-reveal');
    });
    return;
  }

  window.gsap.registerPlugin(window.ScrollTrigger);
  revealItems.forEach((item) => {
    window.gsap.fromTo(
      item,
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: item,
          start: 'top 88%',
          once: true,
        },
      }
    );
  });
}

async function initHomeScene() {
  if (homeSceneCleanup) homeSceneCleanup();
  const canvas = document.getElementById('scene');
  if (!canvas) return;

  let cancelled = false;
  let frameId = 0;
  let renderer = null;
  const listeners = new AbortController();
  homeSceneCleanup = () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
    listeners.abort();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };

  const fallback = document.querySelector('.scene-fallback');
  const reduceMotion = state.reduceMotion;
  if (fallback) {
    fallback.querySelector('p').textContent = 'Memuat model Nailong…';
    fallback.style.display = 'block';
  }

  try {
    const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    if (cancelled || !canvas.isConnected) return;

    const mobile = window.innerWidth < 680;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.2));
    renderer.setSize(canvas.clientWidth || 600, canvas.clientHeight || 560, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, (canvas.clientWidth || 600) / (canvas.clientHeight || 560), 0.1, 100);
    camera.position.set(0, 0.5, 5.6);

    const ambient = new THREE.HemisphereLight(0xfff8e9, 0xd9d0ff, 1.6);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffd45c, 1.8);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9bd8ec, 0.9);
    fillLight.position.set(-3, 2, 5);
    scene.add(fillLight);

    const pointer = { x: 0, y: 0 };
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || reduceMotion) return;
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 1.2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.9;
    }, { signal: listeners.signal });

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      './src/models/nailong-optimized.glb',
      (gltf) => {
        if (cancelled || !canvas.isConnected) {
          gltf.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => material.dispose());
            }
          });
          return;
        }
        if (fallback) fallback.style.display = 'none';
        const model = gltf.scene;
        model.scale.setScalar(2.4);
        model.position.set(0, -0.12, 0);
        model.rotation.y = -0.95;
        scene.add(model);

        const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(model) : null;
        if (mixer) {
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
        }

        camera.lookAt(0, 0.15, 0);
        if (reduceMotion) {
          renderer.render(scene, camera);
          return;
        }

        let previousFrame = 0;
        const frameInterval = 1000 / 24;
        const animate = (now) => {
          if (cancelled) return;
          frameId = requestAnimationFrame(animate);
          if (now - previousFrame < frameInterval) return;
          const delta = Math.min((now - previousFrame) / 1000, 0.1);
          previousFrame = now;

          if (mixer) mixer.update(delta);
          model.position.y = 0.3 + Math.sin(now * 0.0009) * 0.07;
          model.rotation.y = -2.1 + Math.sin(now * 0.00055) * 0.12 + pointer.x * 0.70;
          model.rotation.x = pointer.y * 0.1;
          camera.position.x += (pointer.x * 0.70 - camera.position.x) * 0.90;
          camera.position.y += (0.5 + pointer.y * 0.2 - camera.position.y) * 0.04;
          camera.lookAt(0, 0.15, 0);
          renderer.render(scene, camera);
        };

        frameId = requestAnimationFrame(animate);
      },
      undefined,
      () => {
        if (!cancelled && fallback) {
          fallback.querySelector('p').textContent = 'Nailong tidak dapat dimuat. Periksa koneksi lalu muat ulang untuk mencoba lagi.';
          fallback.style.display = 'block';
        }
      }
    );

    const handleResize = () => {
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 560;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (reduceMotion) renderer.render(scene, camera);
    };

    window.addEventListener('resize', handleResize, { signal: listeners.signal });
  } catch (error) {
    if (cancelled) return;
    console.warn('Three.js scene setup failed:', error);
    if (fallback) {
      fallback.querySelector('p').textContent = 'Adegan 3D tidak dapat dijalankan di peramban ini. Bagian lain tetap bisa dinikmati.';
      fallback.style.display = 'block';
    }
  }
}

function cleanupCurrentPage() {
  closeLightbox();
  if (editorialCollageCleanup) {
    editorialCollageCleanup();
    editorialCollageCleanup = null;
  }
  if (homeSceneCleanup) {
    homeSceneCleanup();
    homeSceneCleanup = null;
  }
  if (window.ScrollTrigger) {
    window.ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
  if (window.gsap) window.gsap.killTweensOf('[data-reveal]');
}

async function navigateToPage(href, pushHistory = true, restoreScroll = 0) {
  const targetUrl = new URL(href, window.location.href);
  const route = targetUrl.pathname.split('/').pop();
  if (targetUrl.origin !== window.location.origin || !pageRoutes.has(route)) {
    window.location.assign(targetUrl.href);
    return;
  }

  if (navigationController) navigationController.abort();
  navigationController = new AbortController();
  try {
    const response = await fetch(targetUrl.href, { signal: navigationController.signal });
    if (!response.ok) throw new Error(`Page request failed: ${response.status}`);
    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextShell = nextDocument.querySelector('.page-shell');
    const currentShell = document.querySelector('.page-shell');
    if (!nextShell || !currentShell) throw new Error('Page shell is missing');

    if (pushHistory) {
      history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
      history.pushState({}, '', targetUrl.href);
    }

    cleanupCurrentPage();
    currentShell.replaceWith(nextShell);
    document.body.dataset.page = nextDocument.body.dataset.page;
    document.title = nextDocument.title;
    document.documentElement.lang = nextDocument.documentElement.lang || 'id';
    initPage();
    window.scrollTo(0, restoreScroll);
    const main = document.querySelector('main');
    if (main) {
      main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.warn('In-page navigation failed; loading the page directly instead:', error);
    window.location.assign(targetUrl.href);
  }
}

function ensureHomeAnimations() {
  if (window.gsap && window.ScrollTrigger) return Promise.resolve();
  if (!homeAnimationLoader) {
    const loadScript = (src) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.append(script);
    });
    homeAnimationLoader = loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js'));
  }
  return homeAnimationLoader;
}

function initNavigation() {
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (url.hash || url.origin !== window.location.origin || !pageRoutes.has(url.pathname.split('/').pop())) return;
    event.preventDefault();
    navigateToPage(url.href);
  });
  window.addEventListener('popstate', (event) => {
    navigateToPage(window.location.href, false, event.state?.scrollY ?? 0);
  });
}

function initPage() {
  initMusicControls();
  editorialCollageCleanup = initEditorialCollage();
  if (document.body.dataset.page === 'home' && (!window.gsap || !window.ScrollTrigger)) {
    ensureHomeAnimations()
      .then(() => {
        if (document.body.dataset.page === 'home') initRevealAnimations();
      })
      .catch((error) => {
        console.warn('Homepage animation setup failed; showing all content:', error);
        if (document.body.dataset.page === 'home') initRevealAnimations();
      });
  } else {
    initRevealAnimations();
  }
  initMediaFallbacks();
  initHomeScene();
  initJarExperience();
  initLightbox();
}

function initEditorialCollage() {
  let cleanup = null;
  document.querySelectorAll('[data-editorial-collage]').forEach((grid) => {
    const cards = [...grid.querySelectorAll('.preview-card')];
    const updateRows = () => {
      const styles = getComputedStyle(grid);
      const rowHeight = parseFloat(styles.gridAutoRows);
      const rowGap = parseFloat(styles.rowGap);
      if (!rowHeight) return;

      cards.forEach((card) => {
        const image = card.querySelector('img');
        const caption = card.querySelector('figcaption');
        if (!image || !caption) return;
        const imageHeight = image.naturalWidth
          ? image.clientWidth * image.naturalHeight / image.naturalWidth
          : 280;
        const contentHeight = imageHeight + caption.offsetHeight + 18;
        card.style.setProperty('--grid-rows', String(Math.ceil((contentHeight + rowGap) / (rowHeight + rowGap))));
      });
    };

    const observer = new ResizeObserver(updateRows);
    observer.observe(grid);
    cards.forEach((card) => {
      const image = card.querySelector('img');
      const caption = card.querySelector('figcaption');
      image?.addEventListener('load', updateRows);
      if (image) observer.observe(image);
      if (caption) observer.observe(caption);
    });
    document.fonts.ready.then(updateRows);
    updateRows();
    cleanup = () => observer.disconnect();
  });
  return cleanup;
}

function showMediaFallback(media, message) {
  if (media.dataset.fallbackShown) return;
  media.dataset.fallbackShown = 'true';
  media.hidden = true;

  const fallback = document.createElement('p');
  fallback.className = 'media-fallback';
  fallback.setAttribute('role', 'status');
  fallback.textContent = message;
  media.insertAdjacentElement('afterend', fallback);
}

function initMediaFallbacks() {
  document.querySelectorAll('img').forEach((image) => {
    const showFallback = () => showMediaFallback(
      image,
      `Foto tidak tersedia: ${image.alt || 'silakan coba lagi nanti.'}`
    );
    image.addEventListener('error', showFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) showFallback();
  });

  document.querySelectorAll('video').forEach((video) => {
    const showFallback = () => showMediaFallback(
      video,
      document.body.dataset.page === 'memories'
        ? 'Video ini belum dapat diputar. Koleksi fotonya tetap bisa dinikmati.'
        : 'Video ini belum dapat diputar. Pesan ulang tahunnya tetap bisa dibaca.'
    );
    video.addEventListener('error', showFallback, { once: true });
    video.querySelectorAll('source').forEach((source) => source.addEventListener('error', showFallback, { once: true }));
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) showFallback();
  });
}

const reminderNotes = [
  { category: 'Motivasi', text: 'Uti, kamu tidak harus tahu seluruh jalan. Cukup pilih satu langkah kecil yang terasa benar hari ini.' },
  { category: 'Motivasi', text: 'Pelan bukan berarti tertinggal. Kamu tetap bergerak, bahkan pada hari-hari ketika langkahmu kecil.' },
  { category: 'Motivasi', text: 'Hal-hal baik yang kamu rawat diam-diam tetap tumbuh, meski belum semuanya terlihat.' },
  { category: 'Motivasi', text: 'Keberanianmu tidak harus selalu ramai. Memulai lagi dengan lembut juga bentuk berani.' },
  { category: 'Motivasi', text: 'Kamu boleh belajar sambil berjalan. Tidak semua jawaban harus sudah ada sebelum kamu mulai.' },
  { category: 'Motivasi', text: 'Ingat, Uti: kamu sudah melewati banyak hari yang dulu terasa berat.' },
  { category: 'Sayangi diri', text: 'Kamu pantas menerima kelembutan yang sama seperti yang sering kamu berikan kepada orang lain.' },
  { category: 'Sayangi diri', text: 'Istirahat bukan hadiah setelah kamu sempurna. Istirahat adalah bagian dari merawat diri.' },
  { category: 'Sayangi diri', text: 'Batasan yang kamu buat tidak menjadikanmu kurang baik. Itu caramu menjaga dirimu tetap utuh.' },
  { category: 'Sayangi diri', text: 'Hari ini, cobalah berbicara kepada dirimu sendiri seperti kepada sahabat yang kamu sayangi.' },
  { category: 'Sayangi diri', text: 'Kamu tetap berharga saat sedang bingung, lelah, atau belum merasa menjadi versi terbaikmu.' },
  { category: 'Sayangi diri', text: 'Tidak apa-apa memilih tenang. Kamu tidak perlu menjelaskan setiap jeda yang kamu butuhkan.' },
  { category: 'Semangat hidup', text: 'Masih ada pagi baru, lagu yang belum kamu dengar, dan hal kecil yang bisa membuatmu tersenyum.' },
  { category: 'Semangat hidup', text: 'Biarkan hidup mengejutkanmu dengan kebaikan yang belum sempat kamu bayangkan.' },
  { category: 'Semangat hidup', text: 'Satu hari yang sulit tidak bisa menceritakan seluruh kisah hidupmu.' },
  { category: 'Semangat hidup', text: 'Tarik napas. Kamu ada di sini, kamu sedang mencoba, dan untuk sekarang itu sudah cukup.' },
  { category: 'Semangat hidup', text: 'Kebahagiaan kadang bersembunyi di hal biasa: minuman hangat, obrolan nyaman, dan sore yang pelan.' },
  { category: 'Semangat hidup', text: 'Semoga hari ini memberimu satu alasan kecil untuk tetap penasaran pada esok.' },
  { category: 'Harapan masa depan', text: 'Semoga hidup yang kamu bangun terasa semakin mirip dengan dirimu sendiri.' },
  { category: 'Harapan masa depan', text: 'Semoga kamu bertemu banyak ruang yang membuatmu merasa diterima tanpa harus mengecilkan diri.' },
  { category: 'Harapan masa depan', text: 'Semoga pilihan-pilihan mendatang membawamu lebih dekat pada damai yang kamu cari.' },
  { category: 'Harapan masa depan', text: 'Ada banyak versi bahagia yang menunggumu. Semoga kamu bebas menemukan versi milikmu.' },
  { category: 'Harapan masa depan', text: 'Semoga impianmu mendapat waktu untuk tumbuh, dan kamu mendapat teman baik di sepanjang jalan.' },
  { category: 'Harapan masa depan', text: 'Semoga masa depan terasa luas: cukup ruang untuk berubah, mencoba lagi, dan memilih dengan hati.' },
  { category: 'Ulang tahun', text: 'Selamat ulang tahun, Uti. Semoga usia baru ini terasa hangat, lapang, dan benar-benar milikmu.' },
  { category: 'Ulang tahun', text: 'Di usia 23, semoga kamu makin dekat pada hal-hal yang membuatmu merasa hidup.' },
  { category: 'Ulang tahun', text: 'Hari ini dunia merayakan kamu—bukan karena pencapaianmu, tapi karena kamu adalah kamu.' },
  { category: 'Ulang tahun', text: 'Semoga setiap lilin yang kamu tiup membawa satu harapan yang terasa ringan untuk dibawa.' },
  { category: 'Ulang tahun', text: 'Untuk Uti: semoga tahun ini dipenuhi tawa yang lepas dan hari-hari yang terasa cukup.' },
  { category: 'Ulang tahun', text: 'Selamat bertambah usia. Semoga kamu selalu punya alasan untuk menyukai hidup yang sedang kamu jalani.' },
];

function initJarExperience() {
  const jar = document.querySelector('[data-page="jar"]');
  if (!jar) return;

  const rolls = document.getElementById('paper-rolls');
  const shakeButton = document.getElementById('shake-button');
  const pickButton = document.getElementById('pick-button');
  const nextButton = document.getElementById('next-button');
  const pickedNote = document.getElementById('picked-note');
  const noteText = document.getElementById('note-text');
  const noteNumber = document.getElementById('note-number');
  const noteCategory = document.getElementById('note-category');
  const noteCard = document.getElementById('note-card');
  const instruction = document.getElementById('jar-instruction');
  const status = document.getElementById('jar-status');
  const remaining = document.getElementById('notes-remaining');
  const jarScene = jar.querySelector('.jar-scene');
  let phase = 'idle';
  let usedNotes = [];
  let previousNoteIndex = -1;
  let selectedNote = null;

  const setPhase = (nextPhase) => {
    phase = nextPhase;
    const canShake = phase === 'idle' || phase === 'ready';
    shakeButton.disabled = !canShake;
    pickButton.disabled = phase !== 'ready';
    nextButton.classList.toggle('hidden', phase !== 'revealed');
    pickedNote.hidden = phase === 'idle' || phase === 'shaking' || phase === 'ready' || phase === 'revealed';
    jar.dataset.phase = phase;
  };

  const fillJar = () => {
    rolls.replaceChildren();
    let seed = 2026;
    reminderNotes.forEach((_, index) => {
      const roll = document.createElement('span');
      roll.className = 'paper-roll';
      seed = (seed * 1664525 + 1013904223) >>> 0;
      roll.style.setProperty('--roll-x', `${12 + ((seed >>> 8) % 74)}%`);
      seed = (seed * 1664525 + 1013904223) >>> 0;
      roll.style.setProperty('--roll-y', `${35 + ((seed >>> 8) % 52)}%`);
      seed = (seed * 1664525 + 1013904223) >>> 0;
      roll.style.setProperty('--roll-turn', `${((seed >>> 8) % 70) - 35}deg`);
      roll.style.setProperty('--roll-delay', `${(index % 5) * 35}ms`);
      roll.style.setProperty('--roll-tone', index % 4 === 0 ? '#f3a28f' : index % 4 === 1 ? '#f4d778' : index % 4 === 2 ? '#a8cfda' : '#c3b3e8');
      rolls.append(roll);
    });
    remaining.textContent = String(reminderNotes.length - usedNotes.length);
    status.textContent = 'Toplesmu penuh dengan pesan-pesan kecil.';
  };

  const resetForNext = () => {
    if (usedNotes.length === reminderNotes.length) {
      usedNotes = [];
      fillJar();
      status.textContent = 'Sekumpulan pesan baru sudah siap.';
    }
    selectedNote = null;
    noteCard.classList.remove('is-revealed');
    noteText.textContent = 'Kocok toplesnya, pilih satu gulungan pesan, lalu biarkan kata-katanya menemukanmu di waktu yang tepat.';
    noteNumber.textContent = '— / 30';
    noteCategory.textContent = 'Pengingat lembut';
    instruction.textContent = 'Mulai dengan menggoyangkan toples. Pilih pesan setelah gulungannya berhenti bergerak.';
    jarScene.classList.remove('is-shaking');
    pickedNote.classList.remove('is-unrolling');
    pickedNote.hidden = true;
    setPhase('idle');
  };

  const drawNote = () => {
    if (usedNotes.length === reminderNotes.length) {
      usedNotes = [];
      fillJar();
    }
    const available = reminderNotes.map((_, index) => index).filter((index) => !usedNotes.includes(index));
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
    }
    if (available[0] === previousNoteIndex && available.length > 1) {
      [available[0], available[1]] = [available[1], available[0]];
    }
    const noteIndex = available[0];
    usedNotes.push(noteIndex);
    previousNoteIndex = noteIndex;
    selectedNote = { ...reminderNotes[noteIndex], number: usedNotes.length };
    remaining.textContent = String(reminderNotes.length - usedNotes.length);
  };

  shakeButton.addEventListener('click', () => {
    if (phase !== 'idle' && phase !== 'ready') return;
    setPhase('shaking');
    jarScene.classList.remove('is-shaking');
    void jarScene.offsetWidth;
    jarScene.classList.add('is-shaking');
    status.textContent = 'Toples bergoyang pelan, pesannya sedang berhenti bergerak…';
    instruction.textContent = 'Tunggu sampai gulungan pesan berhenti bergerak.';
    window.setTimeout(() => {
      jarScene.classList.remove('is-shaking');
      status.textContent = 'Gulungannya sudah tenang. Pilih satu pesan untukmu.';
      instruction.textContent = 'Pilih satu pesan untuk dibuka.';
      setPhase('ready');
    }, state.reduceMotion ? 0 : 920);
  });

  pickButton.addEventListener('click', () => {
    if (phase !== 'ready') return;
    drawNote();
    const firstRoll = rolls.querySelector('.paper-roll');
    if (firstRoll) firstRoll.remove();
    setPhase('picked');
    status.textContent = 'Satu pesan kecil sudah menjadi milikmu.';
    instruction.textContent = 'Pesanmu siap. Ketuk gulungannya untuk membuka isi pesan perlahan.';
  });

  const unrollNote = () => {
    if (phase !== 'picked' || !selectedNote) return;
    setPhase('unrolling');
    pickedNote.classList.add('is-unrolling');
    status.textContent = 'Membuka gulungan pesanmu…';
    window.setTimeout(() => {
      if (phase !== 'unrolling') return;
      noteText.textContent = selectedNote.text;
      noteNumber.textContent = `${String(selectedNote.number).padStart(2, '0')} / 30`;
      noteCategory.textContent = selectedNote.category;
      noteCard.classList.add('is-revealed');
      status.textContent = 'Pesan ini siap menemanimu kapan pun kamu membutuhkannya.';
      instruction.textContent = 'Simpan pesan kecil ini, atau biarkan pesan lain menemukanmu.';
      setPhase('revealed');
    }, state.reduceMotion ? 0 : 720);
  };

  pickedNote.addEventListener('click', unrollNote);
  nextButton.addEventListener('click', resetForNext);

  fillJar();
  setPhase('idle');
}

// ==========================================================================
// PHOTO LIGHTBOX (3D INSTAGRAM-STYLE STACKED CARDS & SWIPE BOUNCE)
// ==========================================================================

const lightboxState = {
  isOpen: false,
  currentIndex: 0,
  items: [],
  container: null,
  deck: null,
  counterCurrent: null,
  counterTotal: null,
  isAnimating: false,
};

function ensureLightboxDom() {
  if (lightboxState.container) return;

  const overlay = document.createElement('div');
  overlay.id = 'photo-lightbox';
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Penampil Foto');

  overlay.innerHTML = `
    <div class="lightbox-backdrop" data-lightbox-close></div>
    <div class="lightbox-header">
      <div class="lightbox-counter" aria-live="polite">
        <span class="lightbox-current-num">1</span>
        <span>/</span>
        <span class="lightbox-total-num">1</span>
      </div>
      <button type="button" class="lightbox-close-btn" aria-label="Tutup penampil foto" data-lightbox-close>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <button type="button" class="lightbox-nav-btn lightbox-prev" aria-label="Foto sebelumnya">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <div class="lightbox-stage">
      <div class="lightbox-deck" id="lightbox-deck"></div>
    </div>
    <button type="button" class="lightbox-nav-btn lightbox-next" aria-label="Foto berikutnya">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  `;

  document.body.appendChild(overlay);

  lightboxState.container = overlay;
  lightboxState.deck = overlay.querySelector('#lightbox-deck');
  lightboxState.counterCurrent = overlay.querySelector('.lightbox-current-num');
  lightboxState.counterTotal = overlay.querySelector('.lightbox-total-num');

  overlay.querySelectorAll('[data-lightbox-close]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
  });

  overlay.querySelector('.lightbox-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if (lightboxState.isAnimating) return;
    triggerPrev();
  });

  overlay.querySelector('.lightbox-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if (lightboxState.isAnimating) return;
    triggerNext();
  });

  window.addEventListener('keydown', (e) => {
    if (!lightboxState.isOpen) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      if (!lightboxState.isAnimating) triggerPrev();
    } else if (e.key === 'ArrowRight') {
      if (!lightboxState.isAnimating) triggerNext();
    }
  });
}

function openLightbox(index, items) {
  ensureLightboxDom();
  lightboxState.items = items;
  lightboxState.currentIndex = index;
  lightboxState.isOpen = true;
  lightboxState.container.setAttribute('aria-hidden', 'false');
  lightboxState.container.classList.add('is-active');
  document.body.classList.add('lightbox-open');
  renderLightboxDeck();
}

function closeLightbox() {
  if (!lightboxState.isOpen) return;
  lightboxState.isOpen = false;
  if (lightboxState.container) {
    lightboxState.container.setAttribute('aria-hidden', 'true');
    lightboxState.container.classList.remove('is-active');
  }
  document.body.classList.remove('lightbox-open');
  if (lightboxState.deck) {
    lightboxState.deck.innerHTML = '';
  }
}

const loadedFullImages = new Set();

function loadHighResImage(card, fullSrc) {
  const fullImg = card.querySelector('.lightbox-full-img');
  const loader = card.querySelector('.uiverse-turtle-loader');
  const errorOverlay = card.querySelector('.lightbox-error-overlay');
  const retryBtn = card.querySelector('.lightbox-retry-btn');
  if (!fullImg || !loader) return;

  // If already loaded in current session, display instantly without loader or flicker
  if (loadedFullImages.has(fullSrc)) {
    fullImg.src = fullSrc;
    fullImg.classList.add('is-loaded');
    loader.classList.remove('is-loading');
    if (errorOverlay) errorOverlay.hidden = true;
    return;
  }

  let showTimer = null;
  let isDone = false;

  const hideLoader = () => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    loader.classList.remove('is-loading');
  };

  const startLoading = (targetUrl) => {
    isDone = false;
    if (errorOverlay) errorOverlay.hidden = true;
    fullImg.classList.remove('is-loaded');

    // Debounce showing loader by 90ms so fast/cached loads never flash the loader
    showTimer = setTimeout(() => {
      if (!isDone) {
        loader.classList.add('is-loading');
      }
    }, 90);

    const testImg = new Image();
    testImg.decoding = 'async';

    testImg.onload = () => {
      isDone = true;
      hideLoader();
      loadedFullImages.add(fullSrc);
      fullImg.src = targetUrl;
      requestAnimationFrame(() => {
        fullImg.classList.add('is-loaded');
      });
    };

    testImg.onerror = () => {
      isDone = true;
      hideLoader();
      fullImg.classList.remove('is-loaded');
      if (errorOverlay) errorOverlay.hidden = false;
    };

    testImg.src = targetUrl;
  };

  if (retryBtn) {
    retryBtn.onclick = (e) => {
      e.stopPropagation();
      const retryUrl = fullSrc.includes('?')
        ? `${fullSrc}&retry=${Date.now()}`
        : `${fullSrc}?retry=${Date.now()}`;
      startLoading(retryUrl);
    };
  }

  startLoading(fullSrc);
}

function renderLightboxDeck() {
  const { deck, items, currentIndex, counterCurrent, counterTotal } = lightboxState;
  if (!deck || !items.length) return;

  const total = items.length;
  if (counterCurrent) counterCurrent.textContent = String(currentIndex + 1);
  if (counterTotal) counterTotal.textContent = String(total);

  deck.innerHTML = '';

  const activeItem = items[currentIndex];
  const nextItem1 = total > 1 ? items[(currentIndex + 1) % total] : null;
  const nextItem2 = total > 2 ? items[(currentIndex + 2) % total] : null;
  const prevItem1 = total > 1 ? items[(currentIndex - 1 + total) % total] : null;

  const createCard = (item, roleClass) => {
    const card = document.createElement('div');
    card.className = `lightbox-card ${roleClass}`;
    card.innerHTML = `
      <div class="lightbox-media-wrap">
        <img class="lightbox-thumb-img" src="${item.thumbSrc}" alt="${item.alt}" decoding="async">
        <img class="lightbox-full-img" alt="${item.alt}" decoding="async">
        <div class="uiverse-turtle-loader" role="status" aria-label="Memuat gambar resolusi tinggi...">
          <div class="turtle-loader-wrapper">
            <div class="turtle-circle"></div>
            <div class="turtle-circle"></div>
            <div class="turtle-circle"></div>
            <div class="turtle-shadow"></div>
            <div class="turtle-shadow"></div>
            <div class="turtle-shadow"></div>
          </div>
        </div>
        <div class="lightbox-error-overlay" hidden aria-live="polite">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p class="lightbox-error-text">Gambar resolusi penuh gagal dimuat.</p>
          <button type="button" class="lightbox-retry-btn">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            Coba Muat Ulang
          </button>
        </div>
      </div>
      ${item.caption ? `<div class="lightbox-card-caption">${item.caption}</div>` : ''}
    `;
    return card;
  };

  let cardPrev1 = null;
  let cardNext2 = null;
  let cardNext1 = null;
  let cardActive = null;

  if (prevItem1) {
    cardPrev1 = createCard(prevItem1, 'is-prev-1');
    deck.appendChild(cardPrev1);
  }
  if (nextItem2) {
    cardNext2 = createCard(nextItem2, 'is-next-2');
    deck.appendChild(cardNext2);
  }
  if (nextItem1) {
    cardNext1 = createCard(nextItem1, 'is-next-1');
    deck.appendChild(cardNext1);
  }

  cardActive = createCard(activeItem, 'is-active');
  deck.appendChild(cardActive);

  // Progressive high-res load with Uiverse loader, debounced flicker protection, and error retry
  loadHighResImage(cardActive, activeItem.fullSrc);

  // Preload next full image in background if not already cached
  if (nextItem1 && !loadedFullImages.has(nextItem1.fullSrc)) {
    const nextPreload = new Image();
    nextPreload.decoding = 'async';
    nextPreload.onload = () => loadedFullImages.add(nextItem1.fullSrc);
    nextPreload.src = nextItem1.fullSrc;
  }

  setupCardGestures(cardActive, cardNext1, cardPrev1);
}

function setupCardGestures(cardActive, cardNext1, cardPrev1) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let startTime = 0;

  const onPointerDown = (e) => {
    if (lightboxState.isAnimating) return;
    if (e.button !== undefined && e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
    startTime = Date.now();

    cardActive.style.transition = 'none';
    if (cardNext1) cardNext1.style.transition = 'none';
    if (cardPrev1) cardPrev1.style.transition = 'none';

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    currentX = e.clientX;
    currentY = e.clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    if (Math.abs(dx) > 5) {
      if (e.cancelable) e.preventDefault();
    }

    cardActive.style.transform = `translate3d(${dx}px, ${dy * 0.22}px, 0) rotate(${dx * 0.045}deg)`;

    if (dx < 0 && cardNext1) {
      const p = Math.min(Math.abs(dx) / 180, 1);
      const scale = 0.93 + 0.07 * p;
      const tx = 16 * (1 - p);
      const ty = 14 * (1 - p);
      const rot = 2.5 * (1 - p);
      const op = 0.68 + 0.32 * p;
      cardNext1.style.transform = `translate3d(${tx}px, ${ty}px, -${35 * (1 - p)}px) scale(${scale}) rotate(${rot}deg)`;
      cardNext1.style.opacity = String(op);
    } else if (dx > 0 && cardPrev1) {
      const p = Math.min(dx / 180, 1);
      const scale = 0.93 + 0.07 * p;
      const tx = -18 * (1 - p) + (dx * 0.35);
      const rot = -2.5 * (1 - p);
      const op = 0.7 * p;
      cardPrev1.style.transform = `translate3d(${tx}px, 14px, -35px) scale(${scale}) rotate(${rot}deg)`;
      cardPrev1.style.opacity = String(op);
    }
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    const dx = currentX - startX;
    const dt = Date.now() - startTime;
    const vx = dx / (dt || 1);

    const threshold = 65;
    const isSwipeNext = dx < -threshold || (dx < -25 && vx < -0.35);
    const isSwipePrev = dx > threshold || (dx > 25 && vx > 0.35);

    if (isSwipeNext && lightboxState.items.length > 1) {
      executeNextAnimation(cardActive, cardNext1);
    } else if (isSwipePrev && lightboxState.items.length > 1) {
      executePrevAnimation(cardActive, cardPrev1);
    } else {
      // Elastic spring bounce back to center!
      cardActive.style.transition = 'transform 0.48s cubic-bezier(0.34, 1.56, 0.64, 1)';
      cardActive.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
      if (cardNext1) {
        cardNext1.style.transition = 'transform 0.48s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease';
        cardNext1.style.transform = 'translate3d(16px, 14px, -35px) scale(0.93) rotate(2.5deg)';
        cardNext1.style.opacity = '0.68';
      }
      if (cardPrev1) {
        cardPrev1.style.transition = 'transform 0.35s ease, opacity 0.3s ease';
        cardPrev1.style.transform = 'translate3d(-18px, 14px, -35px) scale(0.93) rotate(-2.5deg)';
        cardPrev1.style.opacity = '0';
      }
    }
  };

  cardActive.addEventListener('pointerdown', onPointerDown);
}

function executeNextAnimation(activeEl, nextEl) {
  lightboxState.isAnimating = true;
  activeEl.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.35s ease';
  activeEl.style.transform = 'translate3d(-130vw, 20px, 0) rotate(-22deg)';
  activeEl.style.opacity = '0';

  if (nextEl) {
    nextEl.style.transition = 'transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease';
    nextEl.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
    nextEl.style.opacity = '1';
  }

  window.setTimeout(() => {
    lightboxState.currentIndex = (lightboxState.currentIndex + 1) % lightboxState.items.length;
    renderLightboxDeck();
    lightboxState.isAnimating = false;
  }, 380);
}

function executePrevAnimation(activeEl, prevEl) {
  lightboxState.isAnimating = true;
  activeEl.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.35s ease';
  activeEl.style.transform = 'translate3d(130vw, 20px, 0) rotate(22deg)';
  activeEl.style.opacity = '0';

  if (prevEl) {
    prevEl.style.transition = 'transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease';
    prevEl.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
    prevEl.style.opacity = '1';
  }

  window.setTimeout(() => {
    lightboxState.currentIndex = (lightboxState.currentIndex - 1 + lightboxState.items.length) % lightboxState.items.length;
    renderLightboxDeck();
    lightboxState.isAnimating = false;
  }, 380);
}

function triggerNext() {
  const activeEl = lightboxState.deck?.querySelector('.lightbox-card.is-active');
  const nextEl = lightboxState.deck?.querySelector('.lightbox-card.is-next-1');
  if (activeEl) {
    executeNextAnimation(activeEl, nextEl);
  }
}

function triggerPrev() {
  const activeEl = lightboxState.deck?.querySelector('.lightbox-card.is-active');
  const prevEl = lightboxState.deck?.querySelector('.lightbox-card.is-prev-1');
  if (activeEl) {
    executePrevAnimation(activeEl, prevEl);
  }
}

function initLightbox() {
  const cards = document.querySelectorAll('[data-lightbox]');
  if (!cards.length) return;

  const items = Array.from(cards).map((card) => {
    const img = card.querySelector('img');
    const captionEl = card.querySelector('figcaption');
    return {
      fullSrc: card.dataset.fullSrc || img?.src || '',
      thumbSrc: img?.src || '',
      alt: img?.alt || '',
      caption: captionEl ? captionEl.textContent.trim() : ''
    };
  });

  cards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      openLightbox(idx, items);
    });
  });
}

function init() {
  initNavigation();
  initPage();
}

document.addEventListener('DOMContentLoaded', init);

