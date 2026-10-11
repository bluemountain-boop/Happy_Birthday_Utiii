const state = {
  musicEnabled: false,
  musicVolume: 0.7,
  muted: false,
  audio: null,
  audioError: '',
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};
let audioControlsInitialized = false;
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
    state.musicEnabled ? (state.muted ? 'Dibisukan' : 'Sedang diputar') : 'Dijeda'
  );
  const statusDescription = state.audioError || (
    state.musicEnabled
      ? (state.muted ? 'Musik sedang diputar tanpa suara.' : 'Musik sedang diputar.')
      : 'Musik dijeda. Tekan Putar untuk memulai.'
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

async function toggleMusic() {
  const audio = ensureAudio();
  if (!audio.paused) {
    audio.pause();
    setLocalValue('uti23MusicPlaying', false);
    return;
  }

  try {
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
}

async function replayMusic() {
  const audio = ensureAudio();
  try {
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

function init() {
  initNavigation();
  initPage();
}

document.addEventListener('DOMContentLoaded', init);
