const $=id=>document.getElementById(id);
let config={areas:[],responsaveis:[],status:[]},tab='todos';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const badge=s=>`<span class="badge ${s==='Finalizado'?'bfinal':s==='Em andamento'?'band':s==='Pendência'?'bpend':'bwait'}">${esc(s)}</span>`;
async function api(url,opt={}){let r;try{r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt})}catch(e){throw Error('Não foi possível conectar ao servidor. Confira se o Render está como Web Service.')}if(!r.ok){let x={};try{x=await r.json()}catch{}throw Error(x.erro||`Erro HTTP ${r.status}`)}return r.status===204?null:r.json()}
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display='none',2600)}
function nowLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
async function init(){config=await api('/api/config');$('farea').innerHTML=config.areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');$('areaFilter').innerHTML='<option value="">Todas as áreas</option>'+config.areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');$('fresp').innerHTML=config.responsaveis.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('respFilter').innerHTML='<option value="">Todos os responsáveis</option>'+config.responsaveis.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('fstatus').innerHTML=config.status.filter(x=>x!=='Finalizado').map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');await load()}
async function finish(id){
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';

  const agora=new Date();
  const data=agora.toISOString().slice(0,10);
  const hora=agora.toTimeString().slice(0,5);

  modal.innerHTML=`
    <div style="background:white;border-radius:14px;padding:22px;width:min(420px,100%);box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <h2 style="margin-top:0">Finalizar contêiner</h2>

      <label><b>Responsável pela finalização</b></label>
      <select id="finalResponsavel" style="width:100%;padding:12px;margin:6px 0 14px;border-radius:8px">
        <option value="Wendel">Wendel</option>
<option value="Romário">Romário</option>
<option value="Leone">Leone</option>
      </select>

      <label><b>Data de finalização</b></label>
      <input id="finalData" type="date" value="${data}" style="width:100%;padding:12px;margin:6px 0 14px;border-radius:8px">

      <label><b>Horário de finalização</b></label>
      <input id="finalHora" type="time" value="${hora}" style="width:100%;padding:12px;margin:6px 0 20px;border-radius:8px">

      <div style="display:flex;gap:10px">
        <button id="cancelarFinal" type="button" style="flex:1;padding:12px;border:0;border-radius:8px">
          Cancelar
        </button>

        <button id="confirmarFinal" type="button" style="flex:1;padding:12px;border:0;border-radius:8px;background:#198754;color:white">
          Confirmar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancelarFinal').onclick=()=>{
    modal.remove();
  };

  modal.querySelector('#confirmarFinal').onclick=async()=>{
    const responsavel=modal.querySelector('#finalResponsavel').value;
    const dataFinal=modal.querySelector('#finalData').value;
    const horaFinal=modal.querySelector('#finalHora').value;

    if(!dataFinal||!horaFinal){
      alert('Informe a data e o horário da finalização.');
      return;
    }

    const finalizacao=`${dataFinal}T${horaFinal}:00`;

    try{
      await api(`/api/movimentacoes/${id}/finalizar`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          responsavel,
          finalizacao
        })
      });

      modal.remove();
      await load();
    }catch(e){
      alert(e.message);
    }
  };


function openModal(){$('modal').classList.remove('hidden');$('fstart').value=nowLocal();$('fcontainer').focus()}
function closeModal(){$('modal').classList.add('hidden');$('form').reset()}
$('newBtn').onclick=openModal;$('closeBtn').onclick=closeModal;$('cancelBtn').onclick=closeModal;$('refreshBtn').onclick=()=>load();$('clearBtn').onclick=()=>{$('search').value='';$('areaFilter').value='';$('respFilter').value='';load()};$('search').oninput=load;$('areaFilter').onchange=load;$('respFilter').onchange=load;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('listCard').classList.toggle('hidden',tab==='areas');$('areaCard').classList.toggle('hidden',tab!=='areas');load()});
$('form').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{await api('/api/movimentacoes',{method:'POST',body:JSON.stringify({container:$('fcontainer').value,lote:$('flote').value,area:$('farea').value,responsavel:$('fresp').value,status:$('fstatus').value,inicio:$('fstart').value,observacao:$('fobs').value})});closeModal();toast('Movimentação cadastrada com sucesso.');await load()}catch(err){alert(err.message)}finally{btn.disabled=false}};
$('exportBtn').onclick=async()=>{try{const rows=await api('/api/movimentacoes');const h=['ID','CONTÊINER','LOTE','ÁREA','RESPONSÁVEL','INÍCIO','FINALIZAÇÃO','STATUS','OBSERVAÇÃO'];const lines=[h,...rows.map(x=>[x.id,x.container,x.lote,x.area,x.responsavel,x.inicio,x.finalizacao,x.status,x.observacao])].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(','));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}));a.download='controle-armazem-2.0.csv';a.click();URL.revokeObjectURL(a.href)}catch(e){alert(e.message)}};
init().catch(e=>{console.error(e);toast(e.message)});
