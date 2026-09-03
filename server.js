const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'armazem-v2.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS movimentacoes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 container TEXT NOT NULL,
 lote TEXT NOT NULL,
 area TEXT NOT NULL,
 responsavel TEXT NOT NULL,
 inicio TEXT NOT NULL,
 finalizacao TEXT,
 status TEXT NOT NULL DEFAULT 'Aguardando',
 observacao TEXT NOT NULL DEFAULT '',
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mov_container ON movimentacoes(container);
CREATE INDEX IF NOT EXISTS idx_mov_lote ON movimentacoes(lote);
CREATE INDEX IF NOT EXISTS idx_mov_area ON movimentacoes(area);
CREATE INDEX IF NOT EXISTS idx_mov_status ON movimentacoes(status);
`);

const AREAS = [...Array.from({length:20},(_,i)=>`A${String(i+1).padStart(2,'0')}`), ...Array.from({length:20},(_,i)=>`B${String(i+1).padStart(2,'0')}`), 'PÁTIO'];
const RESPONSAVEIS = ['Wendel','Romário','Leone'];
const STATUS = ['Em andamento','Aguardando','Pendência','Finalizado'];

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

function clean(v){ return String(v ?? '').trim(); }
function validEnum(value, list){ return list.includes(value); }
function normalizeContainer(v){ return clean(v).toUpperCase(); }

app.get('/api/health', (_req,res)=>res.json({ok:true, version:'2.0.0'}));
app.get('/api/config', (_req,res)=>res.json({areas:AREAS,responsaveis:RESPONSAVEIS,status:STATUS}));

app.get('/api/movimentacoes', (req,res)=>{
  const q=clean(req.query.q), status=clean(req.query.status), area=clean(req.query.area), responsavel=clean(req.query.responsavel);
  let sql='SELECT * FROM movimentacoes WHERE 1=1'; const params=[];
  if(q){sql+=' AND (container LIKE ? OR lote LIKE ? OR area LIKE ? OR responsavel LIKE ? OR status LIKE ? OR observacao LIKE ?)'; const x=`%${q}%`; params.push(x,x,x,x,x,x);}
  if(status){sql+=' AND status=?';params.push(status);}
  if(area){sql+=' AND area=?';params.push(area);}
  if(responsavel){sql+=' AND responsavel=?';params.push(responsavel);}
  sql+=' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/resumo', (_req,res)=>{
  const r=db.prepare(`SELECT COUNT(*) total,
    SUM(CASE WHEN status='Finalizado' THEN 1 ELSE 0 END) finalizados,
    SUM(CASE WHEN status='Em andamento' THEN 1 ELSE 0 END) andamento,
    SUM(CASE WHEN status='Aguardando' THEN 1 ELSE 0 END) aguardando,
    SUM(CASE WHEN status='Pendência' THEN 1 ELSE 0 END) pendencias FROM movimentacoes`).get();
  const total=Number(r.total||0); const finalizados=Number(r.finalizados||0);
  res.json({...r,percentual:total?Math.round(finalizados*100/total):0});
});

app.get('/api/areas', (_req,res)=>{
  const rows=db.prepare(`SELECT area,COUNT(*) total,
    SUM(CASE WHEN status='Finalizado' THEN 1 ELSE 0 END) finalizados,
    SUM(CASE WHEN status='Em andamento' THEN 1 ELSE 0 END) andamento,
    SUM(CASE WHEN status='Aguardando' THEN 1 ELSE 0 END) aguardando,
    SUM(CASE WHEN status='Pendência' THEN 1 ELSE 0 END) pendencias
    FROM movimentacoes GROUP BY area ORDER BY area`).all();
  res.json(rows);
});

app.post('/api/movimentacoes',(req,res)=>{
  const container=normalizeContainer(req.body.container), lote=clean(req.body.lote), area=clean(req.body.area), responsavel=clean(req.body.responsavel), status=clean(req.body.status)||'Aguardando', inicio=clean(req.body.inicio)||new Date().toISOString(), observacao=clean(req.body.observacao);
  if(!container||!lote||!area||!responsavel) return res.status(400).json({erro:'Preencha contêiner, lote, área e responsável.'});
  if(!validEnum(area,AREAS)) return res.status(400).json({erro:'Área inválida.'});
  if(!validEnum(responsavel,RESPONSAVEIS)) return res.status(400).json({erro:'Responsável inválido.'});
  if(!validEnum(status,STATUS)) return res.status(400).json({erro:'Status inválido.'});
  try{
    const result=db.prepare(`INSERT INTO movimentacoes(container,lote,area,responsavel,inicio,status,observacao) VALUES(?,?,?,?,?,?,?)`).run(container,lote,area,responsavel,inicio,status,observacao);
    res.status(201).json(db.prepare('SELECT * FROM movimentacoes WHERE id=?').get(result.lastInsertRowid));
  }catch(err){res.status(500).json({erro:'Não foi possível salvar a movimentação.',detalhe:err.message});}
});

app.patch('/api/movimentacoes/:id/finalizar',(req,res)=>{
  const id = Number(req.params.id);
  const responsavelRecebido = clean(req.body.responsavel);
const finalizacao = clean(req.body.finalizacao);

if(!id) return res.status(400).json({erro:'ID inválido.'});

const normalizar = texto =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toLowerCase();

const responsavelEncontrado = RESPONSAVEIS.find(
  nome => normalizar(nome) === normalizar(responsavelRecebido)
);

if(!responsavelEncontrado)
  return res.status(400).json({erro:'Responsável inválido.'});

const responsavel = responsavelEncontrado;
}

  const horarioFinalizacao = finalizacao || new Date().toISOString();

  const result = db.prepare(`
    UPDATE movimentacoes
    SET status='Finalizado',
        responsavel=?,
        finalizacao=?,
        atualizado_em=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(responsavel,horarioFinalizacao,id);

  if(!result.changes)
    return res.status(404).json({erro:'Movimentação não encontrada.'});

  res.json(
    db.prepare('SELECT * FROM movimentacoes WHERE id=?').get(id)
  );
});

app.delete('/api/movimentacoes/:id',(req,res)=>{
  const result=db.prepare('DELETE FROM movimentacoes WHERE id=?').run(Number(req.params.id));
  if(!result.changes)return res.status(404).json({erro:'Movimentação não encontrada.'});
  res.status(204).end();
});

app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`Controle Armazém 2.0 rodando na porta ${PORT}`));
