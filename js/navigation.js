/* Navigation et outils */
/* ---------- navigation, outils ---------- */
function show(v){
  if((v==="tableau"||v==="admin")&&!isAdmin())v="saisie";
  document.querySelectorAll(".view").forEach(s=>s.hidden=s.id!=="v-"+v);
  document.querySelectorAll("#nav button").forEach(b=>b.toggleAttribute("aria-current",b.dataset.v===v));
  $("actions").hidden=v!=="saisie";
  if(v==="registre")renderRegistre();if(v==="tableau")renderDash();if(v==="traitement")renderTrait();if(v==="admin")renderAdmin();
  window.scrollTo({top:0});
}
$("nav").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.v);});
$("theme").onclick=()=>{const r=document.documentElement,cur=r.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");const n=cur==="dark"?"light":"dark";r.setAttribute("data-theme",n);try{localStorage.setItem("icompete_theme",n)}catch(e){}};
try{const t=localStorage.getItem("icompete_theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}

let tt;function toast(m){document.querySelectorAll(".toast").forEach(x=>x.remove());const d=document.createElement("div");d.className="toast";d.setAttribute("role","status");d.textContent=m;document.body.appendChild(d);clearTimeout(tt);tt=setTimeout(()=>d.remove(),3200);}
function ask(msg,btns){return new Promise(res=>{
  const d=$("dlg");$("dlgMsg").textContent=msg;
  $("dlgBtns").innerHTML=btns.map((b,i)=>`<button class="btn ${b[1]==="p"?"p":b[1]==="d"?"d":""}" data-i="${i}">${esc(b[0])}</button>`).join("");
  const done=v=>{d.close();res(v);};
  $("dlgBtns").onclick=e=>{const b=e.target.closest("button");if(b)done(+b.dataset.i);};
  d.oncancel=()=>res(-1);
  d.showModal();});}

