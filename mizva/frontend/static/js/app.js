const el = id=>document.getElementById(id);
const log = txt=>{ const p=el('log'); p.innerText = `${new Date().toLocaleTimeString()} ${txt}\n` + p.innerText };

let state = { selectedA:null, selectedB:null, selectedKnown:null };
const spinner = el=>{ if(!el) return; el.classList.add('loading'); };
const stopSpinner = el=>{ if(!el) return; el.classList.remove('loading'); };

// simple tab switching: Verify vs Find
function showTab(tab){ const v = el('panelVerify'); const f = el('panelFind'); if(tab==='verify'){ if(v) v.style.display='block'; if(f) f.style.display='none'; el('tabVerify')?.classList.add('primary'); el('tabFind')?.classList.remove('primary'); } else { if(v) v.style.display='none'; if(f) f.style.display='block'; el('tabFind')?.classList.add('primary'); el('tabVerify')?.classList.remove('primary'); } }
el('tabVerify')?.addEventListener('click', ()=> showTab('verify'));
el('tabFind')?.addEventListener('click', ()=> showTab('find'));

// hide or show the original A/B preview columns depending on active tab
// (Find tab should not show "A - Original" and "B - Original")
function updateCenterPreviewVisibility(tab){
  const previewArea = document.querySelector('.preview-area');
  if(!previewArea) return;
  if(tab === 'find'){
    previewArea.style.display = 'none';
  } else {
    previewArea.style.display = 'flex';
  }
}

// enhance showTab to also toggle center previews
const _origShowTab = showTab;
showTab = function(tab){ _origShowTab(tab); updateCenterPreviewVisibility(tab); };

function readFileURL(input, imgId){ const f = input.files[0]; if(!f) return; const url = URL.createObjectURL(f); const target = el(imgId); if(!target) return; target.src = url; target.style.display = 'block'; }

if(el('fileA')) el('fileA').addEventListener('change', e=>{ readFileURL(e.target,'imgA'); if(el('thumbsA')) el('thumbsA').innerHTML=''; if(el('overA')) el('overA').innerHTML=''; state.selectedA=null });
if(el('fileB')) el('fileB').addEventListener('change', e=>{ readFileURL(e.target,'imgB'); if(el('thumbsB')) el('thumbsB').innerHTML=''; if(el('overB')) el('overB').innerHTML=''; state.selectedB=null });
if(el('fileKnown')) el('fileKnown').addEventListener('change', e=>{ readFileURL(e.target,'imgKnown'); if(el('thumbsKnown')) el('thumbsKnown').innerHTML=''; state.selectedKnown=null });
if(el('fileVideo')) el('fileVideo').addEventListener('change', e=>{
  const f = e.target.files[0];
  const v = el('videoPreview');
  if (!f) { if(v){ v.style.display='none'; v.src=''; } return; }
  v.src = URL.createObjectURL(f);
  v.style.display = 'block';
  // auto-switch to Find tab when user selects a video
  try{ showTab('find'); }catch(e){}
});

async function callDetect(side, inputId){ const input = el(inputId); if(!input.files || !input.files[0]){ alert('Choose a file first'); return; } const fd = new FormData(); fd.append('file', input.files[0]); fd.append('side', side); log(`Detecting faces in ${side}`); const res = await fetch('/detect',{method:'POST',body:fd}); const j = await res.json(); if(j.error){ alert(j.error); return; } // render thumbs
 const thumbsEl = el(side==='a'?'thumbsA':side==='b'?'thumbsB':'thumbsKnown'); thumbsEl.innerHTML=''; j.faces.forEach(f=>{ const img = document.createElement('img'); img.src = f.thumb; img.dataset.index = f.index; img.addEventListener('click', ()=>selectThumb(side, img)); thumbsEl.appendChild(img); }); // draw overlays scaled to image
  const imgEl = el(side==='a'?'imgA':'imgB');
  await new Promise(r=>imgEl.complete? r(): imgEl.onload=r);
    const over = el(side==='a'?'overA':'overB');
    over.innerHTML='';
    // compute image draw rect inside the preview frame to handle object-fit:contain
    const containerRect = over.parentElement.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
    const scaleX = imgRect.width / imgEl.naturalWidth;
    const scaleY = imgRect.height / imgEl.naturalHeight;
    // position overlay container to match the drawn image so child coords are relative
    over.style.left = `${offsetX}px`;
    over.style.top = `${offsetY}px`;
    over.style.width = `${imgRect.width}px`;
    over.style.height = `${imgRect.height}px`;
    over.style.pointerEvents = 'none';
    j.faces.forEach(f=>{
      const d = document.createElement('div');
      d.style.position='absolute';
      const x = f.bbox[0]*scaleX;
      const y = f.bbox[1]*scaleY;
      const w = (f.bbox[2]-f.bbox[0])*scaleX;
      const h = (f.bbox[3]-f.bbox[1])*scaleY;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      d.style.width = `${w}px`;
      d.style.height = `${h}px`;
      d.style.background = 'rgba(128,128,128,0.55)';
      d.style.border = '2px solid rgba(255,255,255,0.04)';
      d.style.cursor='pointer';
      d.dataset.index = f.index;
      d.addEventListener('click', ()=>selectOverlay(side,d));
      // ensure child can receive pointer events
      d.style.pointerEvents = 'auto';
      over.appendChild(d);
    });
    // clear any previous selection outline after redrawing
    Array.from(over.children).forEach(c=>c.style.outline='none');
    log(`Found ${j.faces.length} faces in ${side}`);
  log(`Found ${j.faces.length} faces in ${side}`);
}

function selectThumb(side, imgEl){ const idx = imgEl.dataset.index; if(side==='a'){ state.selectedA = idx; Array.from(el('thumbsA').children).forEach(i=>i.classList.toggle('selected', i.dataset.index===idx)); // sync overlays
  Array.from(el('overA').children).forEach(d=>d.classList.toggle('selected', d.dataset.index==idx));
  // scroll into view
  imgEl.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  imgEl.classList.add('selected');
  } else if(side==='b'){ state.selectedB = idx; Array.from(el('thumbsB').children).forEach(i=>i.classList.toggle('selected', i.dataset.index===idx)); Array.from(el('overB').children).forEach(d=>d.style.outline = (d.dataset.index==idx)?'3px solid #3ddc84':'none'); } else { state.selectedKnown = idx; Array.from(el('thumbsKnown').children).forEach(i=>i.classList.toggle('selected', i.dataset.index===idx)); } log(`Selected ${side} face ${idx}`); }
function selectOverlay(side, div){ const idx = div.dataset.index; // mirror selection
 if(side==='a'){ state.selectedA = idx; Array.from(el('thumbsA').children).forEach(i=>i.classList.toggle('selected', i.dataset.index===idx)); Array.from(el('overA').children).forEach(d=>d.classList.toggle('selected', d.dataset.index==idx)); const thumb = Array.from(el('thumbsA').children).find(t=>t.dataset.index===idx); if(thumb) thumb.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); } else { state.selectedB = idx; Array.from(el('thumbsB').children).forEach(i=>i.classList.toggle('selected', i.dataset.index===idx)); Array.from(el('overB').children).forEach(d=>d.classList.toggle('selected', d.dataset.index==idx)); const thumb = Array.from(el('thumbsB').children).find(t=>t.dataset.index===idx); if(thumb) thumb.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); } log(`Selected overlay ${side}:${idx}`); }

el('detectA')?.addEventListener('click', ()=>callDetect('a','fileA'));
el('detectB')?.addEventListener('click', ()=>callDetect('b','fileB'));
el('detectKnown')?.addEventListener('click', ()=>callDetect('known','fileKnown'));

// clear known file and preview
document.getElementById('clearKnown')?.addEventListener('click', ()=>{
  const fk = el('fileKnown'); if(fk) fk.value = '';
  const thumbs = el('thumbsKnown'); if(thumbs) thumbs.innerHTML = '';
  state.selectedKnown = null;
  const imgk = el('imgKnown'); if(imgk){ imgk.src=''; imgk.style.display='none'; }
});

el('clearA')?.addEventListener('click', ()=>{ el('fileA').value=''; el('imgA').src=''; el('thumbsA').innerHTML=''; el('overA').innerHTML=''; state.selectedA=null });
el('clearB')?.addEventListener('click', ()=>{ el('fileB').value=''; el('imgB').src=''; el('thumbsB').innerHTML=''; el('overB').innerHTML=''; state.selectedB=null });

// threshold UI wiring for verify and find tabs
if(el('thresholdVerify')){
  el('thresholdVerify').addEventListener('input', e=>{ el('thresholdValVerify').innerText = Number(e.target.value).toFixed(2); });
}
if(el('thresholdFind')){
  el('thresholdFind').addEventListener('input', e=>{ el('thresholdValFind').innerText = Number(e.target.value).toFixed(2); });
}

el('compareBtn')?.addEventListener('click', async ()=>{
  // prepare form data for /compare
  const fA = el('fileA'); const fB = el('fileB');
  if(!fA || !fB || !fA.files || !fA.files[0] || !fB.files || !fB.files[0]){ alert('Select both images'); return; }
  const fd = new FormData(); fd.append('file1', fA.files[0]); fd.append('file2', fB.files[0]); if(state.selectedA!==null) fd.append('selected_a', state.selectedA); if(state.selectedB!==null) fd.append('selected_b', state.selectedB);
  const thr = el('thresholdVerify')?.value; if(thr) fd.append('threshold', thr);
  log('Running compare...'); spinner(el('compareBtn'));
  const res = await fetch('/compare',{method:'POST', body:fd}); const j = await res.json(); stopSpinner(el('compareBtn'));
  if(j.error){ alert(j.error); log('Compare failed: '+j.error); return; }
  el('similarity').innerText = (j.similarity).toFixed(4);
  el('annotA').src = j.annot_a; el('annotB').src = j.annot_b;
  log(`Compare done (sim=${j.similarity.toFixed(4)})`);
  if(typeof j.match!=='undefined'){
    el('matchBadge').innerText = j.match?`PASS (>= ${j.threshold})`:`FAIL (< ${j.threshold})`;
    el('matchBadge').style.color = j.match? 'var(--accent)' : 'crimson';
  // briefly animate result
  el('matchBadge').animate([{transform:'scale(0.96)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:400,easing:'ease-out'});
  }
});

el('runFind')?.addEventListener('click', async ()=>{
  const fk = el('fileKnown');
  if(!fk || !fk.files || !fk.files[0]){ alert('choose known image'); return; }
  const fv = el('fileVideo');
  const fd = new FormData(); fd.append('known', fk.files[0]); if(state.selectedKnown!==null) fd.append('selected_known', state.selectedKnown); if(fv && fv.files && fv.files[0]) fd.append('video', fv.files[0]); const thr = el('thresholdFind')?.value; if(thr) fd.append('threshold', thr);
  log('Searching video...');
  // start job
  spinner(el('runFind'));
  el('videoProgressWrap').style.display='block';
  el('videoProgressBar').style.width = '0%';
  // wrap fetch with timeout and better error handling
  let j = null;
  try{
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), 10 * 60 * 1000); // 10 minutes
    const res = await fetch('/find',{method:'POST',body:fd, signal: controller.signal});
    clearTimeout(id);
    stopSpinner(el('runFind'));
    if(!res.ok){
      // try to read server body for more details
      let body = '';
      try{ body = await res.text(); }catch(e){}
      throw new Error('server returned '+res.status + (body?(' - '+body):''));
    }
    j = await res.json();
  }catch(err){ stopSpinner(el('runFind')); el('videoProgressWrap').style.display='none'; const msg = 'Failed to start processing: '+ (err.message||err); alert(msg); try{ el('log').innerText = new Date().toLocaleTimeString() + ' ' + msg + '\n' + el('log').innerText; }catch(e){} console.error(err); return; }
  if(j.error){ alert(j.error); el('videoProgressWrap').style.display='none'; return; }
  if(!j.job_id){ alert('server did not return job id'); el('videoProgressWrap').style.display='none'; return; }
  const jobId = j.job_id;
  // poll status
  let done = false;
  const poll = async ()=>{
    try{
      const s = await fetch(`/find_status/${jobId}`);
      if(!s.ok){ throw new Error('status '+s.status); }
      const r = await s.json();
      if(r.error){ stopSpinner(el('runFind')); el('videoProgressWrap').style.display='none'; alert(r.error); return; }
      el('videoProgressBar').style.width = (r.progress||0)+'%';
      // continue below
      
      if(r.status==='done'){
        // existing done handling continues below via fallthrough
      } else if(r.status==='error'){
        stopSpinner(el('runFind'));
        el('videoProgressWrap').style.display='none';
        alert('Processing failed: '+ r.error);
      } else {
        setTimeout(poll, 600);
      }
      // now handle done case below by returning early if not done
      if(r.status!=='done') return;
    }catch(err){ stopSpinner(el('runFind')); el('videoProgressWrap').style.display='none'; console.error('poll error',err); alert('Error polling job status: '+ (err.message||err)); return; }
    // if we reached here, r.status === 'done' and r is available in closure
    // reuse r from above
    const r = await (async()=>{ try{ const s = await fetch(`/find_status/${jobId}`); return s.ok? await s.json() : {status:'error', error:'bad status'} }catch(e){ return {status:'error', error: e.message||String(e)} } })();
    done = true;
    stopSpinner(el('runFind'));
    el('videoProgressWrap').style.display='none';
    const matches = el('matchesList'); matches.innerHTML='';
    if(r.result && r.result.found && r.result.found.length){
      r.result.found.forEach(m=>{ const d = document.createElement('div'); d.className='match-item'; const im = document.createElement('img'); im.src = m.img; im.addEventListener('click', ()=>{ try{ const lb = el('lightbox'); const lbImg = el('lbImage'); lbImg.src = m.img; lb.style.display='flex'; el('annotB').src = m.img; el('annotA').src = r.result.known || ''; el('similarity').innerText = (m.sim).toFixed(4); el('matchesList').scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){} }); const txt = document.createElement('div'); txt.innerText = `frame ${m.frame} sim ${m.sim.toFixed(3)}`; d.appendChild(im); d.appendChild(txt); matches.appendChild(d); });
      try{ if(el('annotA')) el('annotA').src = r.result.known || ''; if(el('annotB')) el('annotB').src = r.result.found[0].img || ''; if(el('similarity')) el('similarity').innerText = (r.result.found[0].sim).toFixed(4); if(r.result.found[0].sim && el('thresholdFind')){ const thr = Number(el('thresholdFind').value||0); const passed = r.result.found[0].sim >= thr; el('matchBadge').innerText = passed?`PASS (>= ${thr})`:`FAIL (< ${thr})`; el('matchBadge').style.color = passed? 'var(--accent)' : 'crimson'; } }catch(e){}
    } else { if(matches) matches.innerText = 'No matches found'; if(el('annotA')) el('annotA').src=''; if(el('annotB')) el('annotB').src=''; if(el('similarity')) el('similarity').innerText='—'; }
    log('Find finished');
  };
  poll();
});

// help
el('helpBtn')?.addEventListener('click', ()=>{ alert('Tips:\n- Use Detect to pick the exact face when an image has multiple people.\n- Click a thumbnail to select which face to use for compare/find.\n- Use the Search Video button to find the known face in a video.'); });

// initialize default tab
try{ showTab('verify'); }catch(e){}

// lightbox close handlers
el('lbClose')?.addEventListener('click', ()=>{ el('lightbox').style.display='none'; el('lbImage').src=''; });
el('lbBackdrop')?.addEventListener('click', ()=>{ el('lightbox').style.display='none'; el('lbImage').src=''; });
document.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape'){ if(el('lightbox')) el('lightbox').style.display='none'; } });
