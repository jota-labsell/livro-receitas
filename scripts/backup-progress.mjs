// Local recovery snapshots. No network, deployment, secrets, or generated assets.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,access,copyFile,unlink,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(process.env.USERPROFILE || process.env.HOME,'Documents','Backup-livro-receitas-central');
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']});
await mkdir(destination,{recursive:true});
const lock=path.join(destination,'backup.lock');
let locked=false;
try{
 try{await writeFile(lock,String(Date.now()),{flag:'wx'});locked=true;}
 catch(e){
  if(e.code!=='EEXIST')throw e;
  const timestamp=Number(await readFile(lock,'utf8'));
  if(Date.now()-timestamp<5*60000)process.exit(0);
  await unlink(lock);await writeFile(lock,String(Date.now()),{flag:'wx'});locked=true;
 }
 const head=git(['rev-parse','HEAD']).trim();
 const branch=git(['branch','--show-current']).trim();
 const patch=git(['diff','--binary','HEAD','--']);
 // Untracked recovery is limited to source and documentation, never env/key/PDF files.
 const paths=git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean)
  .filter(p=>/\.(?:[cm]?[jt]sx?|css|md|sql|jsonc?|ya?ml)$/.test(p)
   && !/(?:^|\/)(?:\.env|\.dev\.vars|private|credentials?|secrets?)(?:[./-]|$)/i.test(p));
 const files=await Promise.all(paths.map(async p=>({path:p,data:await readFile(path.join(root,p))})));
 const secret=/(?:EAA[A-Za-z0-9]{40,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|APP_USR-[A-Za-z0-9_-]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
 if(secret.test(patch)||files.some(f=>secret.test(f.data.toString('utf8'))))throw Error('Snapshot recusado: possível segredo nas alterações. Revise localmente; nenhum valor foi registrado.');
 const digest=createHash('sha256').update(head).update(branch).update(patch);
 for(const f of files)digest.update(f.path).update(f.data);
 const fingerprint=digest.digest('hex');
 let previous;try{previous=JSON.parse(await readFile(path.join(destination,'latest.json'),'utf8'))}catch{}
 if(previous?.fingerprint===fingerprint){
  await writeFile(path.join(destination,'last-run.json'),JSON.stringify({checkedAt:new Date().toISOString(),result:'unchanged',snapshot:previous.snapshot},null,2));
  console.log('Backup conferido: nenhum código mudou desde o último snapshot.');
 }else{
  const bundles=path.join(destination,'bundles');await mkdir(bundles,{recursive:true});
  const bundle=path.join(bundles,head+'.bundle');
  try{await access(bundle)}catch{const temporary=bundle+'.tmp';git(['bundle','create',temporary,'HEAD']);git(['bundle','verify',temporary]);await rename(temporary,bundle);}
  git(['bundle','verify',bundle]);
  const name=new Date().toISOString().replaceAll(':','-')+'-'+head.slice(0,8);
  const snapshot=path.join(destination,'snapshots',name);await mkdir(snapshot,{recursive:true});
  await writeFile(path.join(snapshot,'tracked.patch'),patch);
  for(const f of files){const target=path.resolve(snapshot,'untracked',f.path);if(!target.startsWith(path.resolve(snapshot,'untracked')+path.sep))throw Error('Caminho de snapshot inválido');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,f.data);}
  await copyFile(path.join(root,'RETOMADA-CENTRAL-GESTAO.md'),path.join(snapshot,'RETOMADA-CENTRAL-GESTAO.md'));
  for(const note of ['JOTAFY-MULTIPRODUTO.md','PAINEL-OPERACAO-DARK.md'])try{await copyFile(path.join(root,note),path.join(snapshot,note));}catch(e){if(e.code!=='ENOENT')throw e;}
  const progress=['# Registro automático do ponto de recuperação','',`Data UTC: ${new Date().toISOString()}`,`Branch: ${branch}`,`HEAD: ${head}`,'','As conclusões e pendências revisadas estão em JOTAFY-MULTIPRODUTO.md e RETOMADA-CENTRAL-GESTAO.md. A lista abaixo registra alterações de arquivos; não comprova testes ou publicação.','','## Alterações rastreadas','',git(['diff','--stat','HEAD','--']),'','## Arquivos novos de código','',...paths.map(p=>'- '+p),''];
  await writeFile(path.join(snapshot,'PROGRESSO.md'),progress.join('\n'));
  const manifest={createdAt:new Date().toISOString(),root,branch,head,bundle,fingerprint,untracked:paths,snapshot,restore:'Clone o bundle em pasta nova; checkout do head; git apply --binary tracked.patch; copie untracked preservando caminhos. Leia RETOMADA-CENTRAL-GESTAO.md.'};
  await writeFile(path.join(snapshot,'manifest.json'),JSON.stringify(manifest,null,2));
  await writeFile(path.join(destination,'latest.json'),JSON.stringify(manifest,null,2));
  await writeFile(path.join(destination,'last-run.json'),JSON.stringify({checkedAt:new Date().toISOString(),result:'saved',snapshot},null,2));
  console.log('Ponto de recuperação salvo: '+snapshot);
 }
 await unlink(path.join(destination,'last-error.txt')).catch(()=>{});
}catch(e){await writeFile(path.join(destination,'last-error.txt'),new Date().toISOString()+' '+(e.message?.startsWith('Snapshot recusado')?e.message:'Falha no backup; verifique o Git, o espaço e a pasta de destino.'));throw Error('Backup não concluído. Consulte last-error.txt na pasta de backup.');}
finally{if(locked)await unlink(lock).catch(()=>{});}
