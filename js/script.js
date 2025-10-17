// Basic Icecast player logic with retry and UI updates
(function () {
  const audio = document.getElementById('radio');
  const playBtn = document.getElementById('playButton');
  const pauseBtn = document.getElementById('pauseButton');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const volume = document.getElementById('volume');

  // Default to same-origin tunnel URL (https://seu-subdominio/stream).
  // If abrindo via file://, cai no fallback localhost.
  // Pode sobrescrever com localStorage('radio.stream').
  function resolveStreamUrl() {
    // Produção: sempre same-origin /stream para evitar mixed content
    if (location.protocol !== 'file:') {
      return location.origin + '/stream';
    }
    // Abertura local por arquivo
    return 'http://127.0.0.1:8000/stream';
  }

  function getEffectiveStreamUrl() {
    // Recalcula a cada play para evitar qualquer cache/override
    return resolveStreamUrl();
  }

  const STREAM_URL = resolveStreamUrl();
  try { console.log('[Player] URL base:', STREAM_URL); } catch (_) {}

  let retryCount = 0;
  const maxRetries = 3;
  let retryTimer = null;

  function setStatus(state, msg) {
    statusDot.style.background = state === 'playing' ? '#2ecc71' : state === 'loading' ? '#f1c40f' : state === 'error' ? '#e74c3c' : '#aaa';
    statusText.textContent = msg;
  }

  function attachStream() {
    const url = getEffectiveStreamUrl();
    const withBuster = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    try { console.log('[Player] Abrindo stream:', withBuster); } catch (_) {}
    audio.src = withBuster;
    audio.load();
  }

  function play() {
    clearTimeout(retryTimer);
    setStatus('loading', 'Conectando...');
    attachStream();
    audio.play().then(() => {
      setStatus('playing', 'Tocando ❤');
    }).catch((err) => {
      handleError(err);
    });
  }

  function pause() {
    clearTimeout(retryTimer);
    audio.pause();
    setStatus('idle', 'Parado');
  }

  function scheduleRetry() {
    if (retryCount >= maxRetries) {
      setStatus('error', 'Falha ao conectar. Tente novamente.');
      return;
    }
    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
    retryCount++;
    setStatus('loading', `Reconectando em ${delay / 1000}s...`);
    retryTimer = setTimeout(() => {
      play();
    }, delay);
  }

  function handleError(err) {
    console.error('Erro no player:', err);
    scheduleRetry();
  }

  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    localStorage.setItem('radio.volume', String(audio.volume));
  });

  // Restore volume preference
  const savedVol = localStorage.getItem('radio.volume');
  if (savedVol !== null) {
    audio.volume = Number(savedVol);
    volume.value = savedVol;
  }

  // Reflect network/media events
  audio.addEventListener('playing', () => setStatus('playing', 'Tocando ❤'));
  audio.addEventListener('pause', () => setStatus('idle', 'Parado'));
  audio.addEventListener('stalled', () => setStatus('loading', 'Reconectando...'));
  audio.addEventListener('waiting', () => setStatus('loading', 'Carregando...'));
  audio.addEventListener('error', () => handleError(audio.error));
})();

// Icecast status polling (song title + listeners)
(function () {
  const titleEl = document.getElementById('songTitle');
  const listenersEl = document.getElementById('listeners');
  const viewersEl = document.getElementById('siteViewers');
  if (!titleEl || !listenersEl) return;

  async function fetchStatus() {
    try {
      // Tenta múltiplos caminhos (túnel pode não rotear ainda)
      const urls = [];
      if (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        urls.push('http://127.0.0.1:8000/status-json.xsl');
      } else {
        urls.push('/status-json.xsl');
        urls.push('/ice/status-json.xsl');
      }

      let res = null;
      for (const u of urls) {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) { res = r; break; }
      }
      if (!res) throw new Error('Status endpoint não encontrado');
      const data = await res.json();
      const source = (data.icestats && (data.icestats.source?.length ? data.icestats.source[0] : data.icestats.source)) || null;
      const title = source?.title || source?._title || '—';
      const listeners = source?.listeners ?? data.icestats?.listeners ?? 0;
      titleEl.textContent = title || '—';
      listenersEl.textContent = `${listeners} ouvintes`;
    } catch (e) {
      // silencioso; mantém último valor
    }
  }

  fetchStatus();
  setInterval(fetchStatus, 10000);

  // Active site visitors
  async function fetchViewers() {
    if (!viewersEl) return;
    try {
      const res = await fetch('api/visitors.php', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      viewersEl.textContent = `${data.active} no site`;
    } catch {}
  }
  fetchViewers();
  setInterval(fetchViewers, 15000);
})();

// Guestbook and photos logic
(function () {
  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
    });
    children.forEach(c => e.appendChild(c));
    return e;
  }

  async function loadRecados() {
    const list = document.getElementById('recadoList');
    if (!list) return;
    list.innerHTML = '';
    try {
      const items = await fetchJson('api/recados.php');
      items.slice().reverse().forEach(item => {
        const avatar = item.avatar ? el('img', { src: item.avatar, alt: item.name }) : el('div', { class: 'noavatar', html: '💌' });
        
        const content = el('div', {}, [
          el('strong', { html: escapeHtml(item.name) }),
          el('br'),
          el('span', { html: escapeHtml(item.message) })
        ]);
        
        const deleteBtn = isAdmin ? el('button', { 
          class: 'delete-btn', 
          html: '×',
          onclick: () => deleteRecado(item.id)
        }) : null;
        
        const li = el('li', { class: 'comment-item' }, [avatar, content, deleteBtn].filter(Boolean));
        list.appendChild(li);
      });
    } catch (e) {
      list.innerHTML = '<li>Não foi possível carregar os recados.</li>';
    }
  }

  async function deleteRecado(recadoId) {
    if (!confirm('Tem certeza que quer apagar este recado?')) return;
    
    // Implementar delete de recados se necessário
    alert('Função de delete de recados não implementada ainda');
  }

  async function loadPhotos() {
    const grid = document.getElementById('photoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    try {
      const items = await fetchJson('api/photos.php');
      items.slice().reverse().forEach(item => {
        const img = el('img', { src: item.photo, alt: item.caption || 'Foto' });
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openPhotoModal(item));
        grid.appendChild(img);
      });
    } catch (e) {
      grid.innerHTML = '<p>Não foi possível carregar as fotos.</p>';
    }
  }

  function openPhotoModal(photo) {
    const modal = document.getElementById('photoModal');
    const modalImage = document.getElementById('modalImage');
    const modalAuthor = document.getElementById('modalAuthor');
    const modalCaption = document.getElementById('modalCaption');
    const commentPhotoId = document.getElementById('commentPhotoId');
    
    modalImage.src = photo.photo;
    modalAuthor.textContent = photo.author || 'Anônimo';
    modalCaption.textContent = photo.caption || 'Sem legenda';
    commentPhotoId.value = photo.id;
    
    modal.style.display = 'block';
    loadComments(photo.id);
  }

  let isAdmin = false;

  async function loadComments(photoId) {
    const list = document.getElementById('commentsList');
    if (!list) return;
    list.innerHTML = '';
    try {
      const items = await fetchJson(`api/comments.php?photoId=${photoId}`);
      items.forEach(item => {
        const content = el('div', { class: 'comment-content' }, [
          el('strong', { html: item.author }),
          el('p', { html: escapeHtml(item.comment) })
        ]);
        
        const deleteBtn = isAdmin ? el('button', { 
          class: 'delete-btn', 
          html: '×',
          onclick: () => deleteComment(item.id, photoId)
        }) : null;
        
        const li = el('li', { class: 'comment-item' }, [content, deleteBtn].filter(Boolean));
        list.appendChild(li);
      });
    } catch (e) {
      list.innerHTML = '<li>Não foi possível carregar os comentários.</li>';
    }
  }

  async function deleteComment(commentId, photoId) {
    if (!confirm('Tem certeza que quer apagar este comentário?')) return;
    
    const fd = new FormData();
    fd.append('action', 'delete');
    fd.append('commentId', commentId);
    fd.append('login', 'foda-se');
    fd.append('password', 'meuperuhacker753159');
    
    try {
      const res = await fetch('api/comments.php', { method: 'POST', body: fd });
      const js = await res.json();
      if (!res.ok || js.error) throw new Error(js.error || 'Erro');
      loadComments(photoId);
    } catch (err) {
      alert('Falha ao apagar comentário: ' + err.message);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
  }

  const recadoForm = document.getElementById('recadoForm');
  if (recadoForm) {
    recadoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(recadoForm);
      const btn = recadoForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        const res = await fetch('api/recados.php', { method: 'POST', body: fd });
        const js = await res.json();
        if (!res.ok || js.error) throw new Error(js.error || 'Erro');
        recadoForm.reset();
        loadRecados();
      } catch (err) {
        alert('Falha ao enviar recado: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Enviar recado';
      }
    });
  }

  const photoForm = document.getElementById('photoForm');
  if (photoForm) {
    photoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(photoForm);
      const btn = photoForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        const res = await fetch('api/photos.php', { method: 'POST', body: fd });
        const js = await res.json();
        if (!res.ok || js.error) throw new Error(js.error || 'Erro');
        photoForm.reset();
        loadPhotos();
      } catch (err) {
        alert('Falha ao postar foto: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Postar foto';
      }
    });
  }

  // Modal controls
  const modal = document.getElementById('photoModal');
  const closeBtn = document.querySelector('.close');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  // Comment form
  const commentForm = document.getElementById('commentForm');
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(commentForm);
      const btn = commentForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        const res = await fetch('api/comments.php', { method: 'POST', body: fd });
        const js = await res.json();
        if (!res.ok || js.error) throw new Error(js.error || 'Erro');
        commentForm.reset();
        const photoId = document.getElementById('commentPhotoId').value;
        loadComments(photoId);
      } catch (err) {
        alert('Falha ao enviar comentário: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Comentar';
      }
    });
  }

  // Admin form
  const adminForm = document.getElementById('adminForm');
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(adminForm);
      const login = fd.get('login');
      const password = fd.get('password');
      
      if (login === 'foda-se' && password === 'meuperuhacker753159') {
        isAdmin = true;
        document.getElementById('adminPanel').style.display = 'none';
        alert('Login admin realizado! Agora você pode apagar comentários.');
        // Recarrega comentários para mostrar botões de delete
        const photoId = document.getElementById('commentPhotoId').value;
        if (photoId) loadComments(photoId);
        // Recarrega recados também
        loadRecados();
      } else {
        alert('Login ou senha incorretos!');
      }
    });
  }

  
  const adminBtn = document.getElementById('adminBtn');
  
  if (adminBtn) {
    adminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const adminPanel = document.getElementById('adminPanel');
      if (adminPanel) {
        const isHidden = adminPanel.style.display === 'none' || adminPanel.style.display === '';
        adminPanel.style.display = isHidden ? 'block' : 'none';
      }
    });
  }

  // initial load
  loadRecados();
  loadPhotos();
})();


