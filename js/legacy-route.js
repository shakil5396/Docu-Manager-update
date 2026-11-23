(() => {
  const page = document.body.dataset.legacy;
  const params = new URLSearchParams(location.search);
  if (page === 'upload') { location.replace('dashboard.html?open=upload'); return; }
  if (page === 'login') { location.replace('index.html'); return; }
  if (page === 'register') { location.replace('index.html?mode=register'); return; }
  if (page === 'view') { const id = params.get('id'); const file = params.get('file'); location.replace(id ? `dashboard.html?preview=${encodeURIComponent(id)}` : file ? `dashboard.html?file=${encodeURIComponent(file)}` : 'dashboard.html?view=documents'); return; }
  if (page === 'documents') { const type = params.get('type'); const view = type === 'favorites' ? 'favorites' : type === 'trash' ? 'trash' : 'documents'; const kind = ['excel','csv'].includes(type) ? 'spreadsheet' : type === 'word' ? 'document' : type; location.replace(`dashboard.html?view=${view}${['pdf','image','spreadsheet','document'].includes(kind) ? `&type=${encodeURIComponent(kind)}` : ''}`); }
})();
