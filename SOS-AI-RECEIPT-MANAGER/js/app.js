
const API_URL = 'https://script.google.com/macros/s/AKfycbyOvDOerVr5kGC6mGluVBvcNxseJxM6drkzBgGmerVKeXobojkvoGqfwCd0I_kI5G18/exec';
let students=[], receipts=[], editingId=null, receiptCounter=1001, selectedIds=new Set();

async function loadFromSheet() {
  try {
    const [sRes, rRes] = await Promise.all([
      fetch(API_URL + '?sheet=Students'),
      fetch(API_URL + '?sheet=Receipts')
    ]);
    const sData = await sRes.json();
    const rData = await rRes.json();
    students = (sData.data || []).map(s => ({
      ...s,
      id: Number(s.id),
      fee: Number(s.fee) || 0,
      advance: Number(s.advance) || 0,
      service: Number(s.service) || 0,
      other: Number(s.other) || 0,
      duration: s.duration || ''
    }));
    receipts = (rData.data || []).map(r => ({
  ...r,
  id: Number(String(r.receiptNo).replace('RCP-', '')),
  studentId: Number(r.studentId)
   }));
    if (receipts.length > 0) {
      const validIds = receipts
  .map(r => r.id)
  .filter(id => !isNaN(id));

receiptCounter = validIds.length
  ? Math.max(...validIds) + 1
  : 1001;
    }
    initBatchFilters();
    renderDashboard();
  } catch (err) {
    console.error('Failed to load from Google Sheet:', err);
    alert('Could not connect to Google Sheet. Check your API_URL.');
  }
}

const fmt=n=>isNaN(n)||n===''?'₹0.00':'₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const nv=v=>parseFloat(v)||0;


function getStatus(s){
  const bal=nv(s.fee)+nv(s.service)+nv(s.other)-nv(s.advance);
  if(bal<=0) return 'Paid';
  if(nv(s.advance)>0) return 'Partial';
  return 'Due';
}

function clearAllData(){
  if(!confirm('Delete ALL demo students and receipts? This cannot be undone.')) return;
  students=[];receipts=[];selectedIds.clear();
  renderStudents();renderDashboard();
}

function deleteStudent(id){
  if(!confirm('Delete this student and their receipt?')) return;
  students=students.filter(s=>s.id!==id);
  receipts=receipts.filter(r=>r.studentId!==id);
  pushToSheet('delete','Students',null,id);
  pushToSheet('delete','Receipts',null,id);
  fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'delete', sheet:'Students', id }) });
  fetch(API_URL, { method:'POST', body: JSON.stringify({ action:'delete', sheet:'Receipts', id }) });
  selectedIds.delete(id);
  renderStudents();renderDashboard();
}

function deleteSelected(){
  if(selectedIds.size===0) return;
  if(!confirm(`Delete ${selectedIds.size} selected student(s)?`)) return;
  students=students.filter(s=>!selectedIds.has(s.id));
  receipts=receipts.filter(r=>!selectedIds.has(r.studentId));
  selectedIds.clear();
  updateBulkBar();renderStudents();renderDashboard();
}

function toggleCheckbox(id,checked){
  checked?selectedIds.add(id):selectedIds.delete(id);
  updateBulkBar();
  const hcb=document.getElementById('header-cb');
  const visible=getFilteredStudents();
  if(hcb) hcb.checked=visible.length>0&&visible.every(s=>selectedIds.has(s.id));
}

function toggleSelectAll(checked){
  const visible=getFilteredStudents();
  visible.forEach(s=>checked?selectedIds.add(s.id):selectedIds.delete(s.id));
  document.querySelectorAll('.row-cb').forEach(cb=>{cb.checked=checked});
  const hcb=document.getElementById('header-cb');
  if(hcb) hcb.checked=checked;
  updateBulkBar();
}

function clearSelection(){
  selectedIds.clear();
  document.querySelectorAll('.row-cb').forEach(cb=>{cb.checked=false});
  const hcb=document.getElementById('header-cb');
  if(hcb) hcb.checked=false;
  updateBulkBar();
}

function updateBulkBar(){
  const bar=document.getElementById('bulk-bar');
  const cnt=document.getElementById('bulk-count');
  if(selectedIds.size>0){bar.style.display='flex';cnt.textContent=selectedIds.size+' selected';}
  else{bar.style.display='none';}
}

function getFilteredStudents(){
  const search=(document.getElementById('search-student')||{value:''}).value.toLowerCase();
  const batchF=(document.getElementById('filter-batch')||{value:''}).value;
  const statusF=(document.getElementById('filter-status')||{value:''}).value;
  return students.filter(s=>{
    if(batchF&&s.batch!==batchF) return false;
    if(statusF&&getStatus(s)!==statusF) return false;
    if(search&&!s.name.toLowerCase().includes(search)&&!s.mobile.includes(search)) return false;
    return true;
  });
}

function initBatchFilters(){
  const batches=[...new Set(students.map(s=>s.batch))].sort();
  ['filter-batch','filter-receipt-batch'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel) return;
    const cur=sel.value;
    sel.innerHTML='<option value="">All batches</option>'+batches.map(b=>`<option value="${b}">${b}</option>`).join('');
    sel.value=cur;
  });
}

function showSection(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  const map={'dashboard':0,'students':1,'receipts':2,'add-student':3};
  const idx=map[id];
  if(idx!==undefined) document.querySelectorAll('.nav-btn')[idx].classList.add('active');
  if(id==='dashboard') renderDashboard();
  if(id==='students'){initBatchFilters();renderStudents();}
  if(id==='receipts'){initBatchFilters();renderReceiptsList();}
  if(id==='add-student'){editingId=null;clearForm();}
}

function switchFormTab(idx,btn){
  document.querySelectorAll('.tab-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('form-tab-0').style.display=idx===0?'block':'none';
  document.getElementById('form-tab-1').style.display=idx===1?'block':'none';
  if(idx===1) calcFeePreview();
}

function calcFeePreview(){
  const fee=nv(document.getElementById('f-fee').value);
  const adv=nv(document.getElementById('f-advance').value);
  const svc=nv(document.getElementById('f-service').value);
  const oth=nv(document.getElementById('f-other').value);
  const gst=(fee+svc)*0.18;
  const total=fee+svc+gst+oth;
  const bal=total-adv;
  document.getElementById('fee-preview').innerHTML=[['Total fee',total],['Advance paid',adv],['GST (18%)',gst],['Balance',bal]].map(([l,v])=>`<div style="background:var(--color-background-primary);padding:8px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary)"><div style="font-size:10px;color:var(--color-text-secondary)">${l}</div><div style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-top:2px">${fmt(v)}</div></div>`).join('');
}

function clearForm(){
  ['f-name','f-mobile','f-email','f-batch','f-course','f-duration','f-joindate','f-paymode','f-fee','f-advance','f-service','f-other','f-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('form-title').textContent='Add new student';
  switchFormTab(0,document.querySelectorAll('.tab-pill')[0]);
}

function saveStudent(){
  const name=document.getElementById('f-name').value.trim();
  const mobile=document.getElementById('f-mobile').value.trim();
  const batch=document.getElementById('f-batch').value;
  const course=document.getElementById('f-course').value;
  if(!name||!mobile||!batch||!course){alert('Please fill Name, Mobile, Batch and Course.');return;}
  const now = new Date();

  const studentId =
  String(now.getDate()).padStart(2,'0') +
  String(now.getMonth()+1).padStart(2,'0') +
  now.getFullYear() +
  String(now.getHours()).padStart(2,'0') +
  String(now.getMinutes()).padStart(2,'0') +
  String(now.getSeconds()).padStart(2,'0');
  const s={id:editingId|| studentId,name,mobile,email:document.getElementById('f-email').value,batch,course,duration:document.getElementById('f-duration').value,joindate:document.getElementById('f-joindate').value,paymode:document.getElementById('f-paymode').value,fee:nv(document.getElementById('f-fee').value),advance:nv(document.getElementById('f-advance').value),service:nv(document.getElementById('f-service').value),other:nv(document.getElementById('f-other').value),notes:document.getElementById('f-notes').value};
  if(editingId){
  const idx=students.findIndex(x=>x.id===editingId);
  if(idx>=0) students[idx]=s;
  fetch(API_URL, {
    method:'POST',
    body: JSON.stringify({ action:'update', sheet:'Students', id:s.id, row:s })
  });
} else {
  students.push(s);
  fetch(API_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'insert',
    sheet: 'Students',
    row: s
  })
});
  const receipt = {
    receiptNo:'RCP-'+receiptCounter,
    studentId: s.id,
    date: new Date().toISOString().slice(0,10)
  };
  receipts.push({...receipt, id: receiptCounter});
  receiptCounter++;
  fetch(API_URL, {
    method:'POST',
    mode:'no-cors',
     body: JSON.stringify({ action:'insert', sheet:'Receipts', row: receipt })
  });
  
}
  editingId=null;
  showSection('students');
}

function editStudent(id){
  const s=students.find(x=>x.id===id);
  if(!s) return;
  editingId=id;
  document.getElementById('form-title').textContent='Edit student';
  document.getElementById('f-name').value=s.name;
  document.getElementById('f-mobile').value=s.mobile;
  document.getElementById('f-email').value=s.email||'';
  document.getElementById('f-batch').value=s.batch;
  document.getElementById('f-course').value=s.course;
  document.getElementById('f-duration').value=s.duration||'';
  document.getElementById('f-joindate').value=s.joindate||'';
  document.getElementById('f-paymode').value=s.paymode||'Cash';
  document.getElementById('f-fee').value=s.fee||'';
  document.getElementById('f-advance').value=s.advance||'';
  document.getElementById('f-service').value=s.service||'';
  document.getElementById('f-other').value=s.other||'';
  document.getElementById('f-notes').value=s.notes||'';
  showSection('add-student');
}

function renderDashboard(){
  const total=students.length;
  const paid=students.filter(s=>getStatus(s)==='Paid').length;
  const collected=students.reduce((a,s)=>a+nv(s.advance),0);
  const totalFee=students.reduce((a,s)=>a+nv(s.fee)+nv(s.service)*1.18+nv(s.other),0);
  document.getElementById('stats-grid').innerHTML=[['Total students',total,'across all batches'],['Fully paid',paid,'out of '+total],['Collected',fmt(collected),'total advance'],['Pending',fmt(totalFee-collected),'outstanding balance']].map(([l,v,s])=>`<div class="stat"><div class="stat-label">${l}</div><div class="stat-val">${v}</div><div class="stat-sub">${s}</div></div>`).join('');
  const batches=[...new Set(students.map(s=>s.batch))].sort();
  document.getElementById('batch-overview').innerHTML=students.length===0?'<div style="padding:24px;text-align:center;color:var(--color-text-secondary);font-size:13px">No students yet. Add your first student.</div>':'<table><thead><tr><th>Batch</th><th>Students</th><th>Collected</th><th>Pending</th><th>Progress</th></tr></thead><tbody>'+batches.map(b=>{const bs=students.filter(s=>s.batch===b);const bc=bs.reduce((a,s)=>a+nv(s.advance),0);const bt=bs.reduce((a,s)=>a+nv(s.fee)+nv(s.service)*1.18+nv(s.other),0);const pct=bt>0?Math.round(bc/bt*100):0;return`<tr><td><span class="badge badge-batch">${b}</span></td><td class="text-center">${bs.length}</td><td>${fmt(bc)}</td><td>${fmt(bt-bc)}</td><td style="min-width:80px"><div style="font-size:10px;color:var(--color-text-secondary);margin-bottom:2px">${pct}%</div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></td></tr>`;}).join('')+'</tbody></table>';
  const recent=receipts.slice(-6).reverse();
  document.getElementById('recent-receipts').innerHTML=recent.length===0?'<div style="padding:24px;text-align:center;color:var(--color-text-secondary);font-size:13px">No receipts yet.</div>':'<table><thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th></th></tr></thead><tbody>'+recent.map(r=>{const s=students.find(x=>x.id===r.studentId);if(!s)return'';return`<tr><td style="font-size:11px;color:var(--color-text-secondary)">${r.receiptNo}</td><td><div class="flex"><div class="avatar">${s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><span style="font-size:12px">${s.name}</span></div></td><td style="font-size:12px;font-weight:500">${fmt(s.fee)}</td><td><button class="btn btn-sm" onclick="viewReceipt(${r.id})">View</button></td></tr>`;}).join('')+'</tbody></table>';
}

function renderStudents(){
  const list=getFilteredStudents();
  document.getElementById('student-count').textContent=list.length+' students';
  if(list.length===0){document.getElementById('students-body').innerHTML='<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--color-text-secondary);font-size:13px">No students found. Click "+ Add student" to get started.</td></tr>';return;}
  document.getElementById('students-body').innerHTML=list.map((s,i)=>{
    const status=getStatus(s);
    const badgeCls=status==='Paid'?'badge-paid':status==='Partial'?'badge-partial':'badge-due';
    const bal=nv(s.fee)+nv(s.service)*1.18+nv(s.other)-nv(s.advance);
    const checked=selectedIds.has(s.id)?'checked':'';
    return`<tr>
      <td class="cb-col"><input type="checkbox" class="row-cb" ${checked} onchange="toggleCheckbox(${s.id},this.checked)"></td>
      <td style="color:var(--color-text-secondary);font-size:11px">${i+1}</td>
      <td><div class="flex"><div class="avatar">${s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><div><div style="font-size:12px">${s.name}</div><div style="font-size:10px;color:var(--color-text-secondary)">${s.mobile}</div></div></div></td>
      <td><span class="badge badge-batch">${s.batch}</span></td>
      <td style="font-size:11px;color:var(--color-text-secondary)">${s.course.split(' ').slice(0,2).join(' ')}</td>
      <td class="text-right" style="font-size:12px">${fmt(s.fee)}</td>
      <td class="text-right" style="font-size:12px;color:var(--color-text-success)">${fmt(s.advance)}</td>
      <td class="text-right" style="font-size:12px;color:${bal>0?'var(--color-text-danger)':'var(--color-text-success)'}">${fmt(bal)}</td>
      <td><span class="badge ${badgeCls}">${status}</span></td>
      <td>
        <div class="flex">
          <button class="btn btn-sm" onclick="viewStudentReceipt(${s.id})">Receipt</button>
          <button class="btn btn-sm" onclick="editStudent(${s.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})" title="Delete student">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderReceiptsList(){
  const search=(document.getElementById('search-receipt').value||'').toLowerCase();
  const batchF=document.getElementById('filter-receipt-batch').value;
  const list=receipts.filter(r=>{const s=students.find(x=>x.id===r.studentId);if(!s)return false;if(batchF&&s.batch!==batchF)return false;if(search&&!s.name.toLowerCase().includes(search)&&!r.receiptNo.toLowerCase().includes(search))return false;return true;});
  document.getElementById('receipt-count').textContent=list.length+' receipts';
  document.getElementById('receipts-body').innerHTML=list.length===0?'<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--color-text-secondary);font-size:13px">No receipts found.</td></tr>':list.map(r=>{const s=students.find(x=>x.id===r.studentId);if(!s)return'';const gst=(nv(s.fee)+nv(s.service))*0.18;const total=nv(s.fee)+nv(s.service)+gst+nv(s.other);const bal=total-nv(s.advance);return`<tr><td style="font-size:11px;color:var(--color-text-secondary)">${r.receiptNo}</td><td><div class="flex"><div class="avatar">${s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>${s.name}</div></td><td><span class="badge badge-batch">${s.batch}</span></td><td style="font-size:11px;color:var(--color-text-secondary)">${s.course.split(' ').slice(0,2).join(' ')}</td><td style="font-size:11px;color:var(--color-text-secondary)">${r.date}</td><td class="text-right" style="font-size:12px;font-weight:500">${fmt(total)}</td><td class="text-right" style="font-size:12px;color:var(--color-text-success)">${fmt(s.advance)}</td><td class="text-right" style="font-size:12px;color:${bal>0?'var(--color-text-danger)':'var(--color-text-success)'}">${fmt(bal)}</td><td><button class="btn btn-sm btn-primary" onclick="viewReceipt(${r.id})">View</button></td></tr>`;}).join('');
}
function viewStudentReceipt(studentId){
  console.log("Student ID:", studentId);
  console.log("Receipts:", receipts);

  const r = receipts.find(x => x.studentId === studentId);

  console.log("Found Receipt:", r);

  if(r) viewReceipt(r.id);
}

function viewReceipt(rid){
  const r=receipts.find(x=>x.id===rid);if(!r)return;
  const s=students.find(x=>x.id===r.studentId);if(!s)return;
  const gst=(nv(s.fee)+nv(s.service))*0.18;
  const total=nv(s.fee)+nv(s.service)+gst+nv(s.other);
  const bal=total-nv(s.advance);
  const colW='28px 60px 1fr 56px 80px 80px 80px 80px';
  document.getElementById('rv-title').textContent=r.receiptNo+' — '+s.name;
  document.getElementById('receipt-print-area').innerHTML=`<div class="rh"><div class="rh-logo">LOGO</div><div class="rh-name"><h2>SOS AI TECHNO SOLUTIONS</h2><p>AI ACADEMY</p></div><div class="rh-logo">LOGO</div></div><div class="r-banner">RECEIPT</div><div class="r-info"><div class="r-info-cell"><span class="r-info-lbl">Receipt No :</span><span class="r-info-val">${r.receiptNo}</span></div><div class="r-info-cell"><span class="r-info-lbl">Bill No :</span><span class="r-info-val">${r.receiptNo}</span></div><div class="r-info-cell"><span class="r-info-lbl">Date :</span><span class="r-info-val">${r.date}</span></div></div><div class="r-info"><div class="r-info-cell" style="grid-column:span 2"><span class="r-info-lbl">Student Name :</span><span class="r-info-val">${s.name}</span></div><div class="r-info-cell"><span class="r-info-lbl">Mobile :</span><span class="r-info-val">${s.mobile}</span></div></div><div class="r-info"><div class="r-info-cell" style="grid-column:span 2"><span class="r-info-lbl">Course :</span><span class="r-info-val">${s.course}</span></div><div class="r-info-cell"><span class="r-info-lbl">Batch :</span><span class="r-info-val"><span class="badge badge-batch">${s.batch}</span></span></div></div><div class="r-col-hdr" style="grid-template-columns:${colW}"><div class="r-ch">Sr</div><div class="r-ch">Type</div><div class="r-ch">Description</div><div class="r-ch">Days</div><div class="r-ch">Fee (₹)</div><div class="r-ch">Advance (₹)</div><div class="r-ch">Balance (₹)</div><div class="r-ch">Total (₹)</div></div>${[['01','Course',s.course,s.duration||'—',nv(s.fee),nv(s.advance),nv(s.fee)-nv(s.advance),nv(s.fee)],nv(s.service)?['02','Service','Service Charges','—',nv(s.service),0,nv(s.service),nv(s.service)]:null,['03','Tax GST','GST @ 18%','—',gst,0,gst,gst],nv(s.other)?['04','Other','Other Charges','—',nv(s.other),0,nv(s.other),nv(s.other)]:null].filter(Boolean).map((row,i)=>`<div class="r-row" style="grid-template-columns:${colW};background:${i%2===0?'#fff':'#EBF3FB'}"><div class="r-cell" style="justify-content:center;color:var(--color-text-secondary);font-size:10px">${row[0]}</div><div class="r-cell" style="font-size:10px;color:var(--color-text-secondary)">${row[1]}</div><div class="r-cell" style="font-size:11px">${row[2]}</div><div class="r-cell" style="justify-content:center;font-size:11px">${row[3]}</div><div class="r-cell" style="justify-content:flex-end;font-family:var(--font-mono);font-size:11px">${fmt(row[4])}</div><div class="r-cell" style="justify-content:flex-end;font-family:var(--font-mono);font-size:11px">${fmt(row[5])}</div><div class="r-cell" style="justify-content:flex-end;font-family:var(--font-mono);font-size:11px">${fmt(row[6])}</div><div class="r-cell" style="justify-content:flex-end;font-family:var(--font-mono);font-size:11px">${fmt(row[7])}</div></div>`).join('')}<div class="r-total-row" style="grid-template-columns:${colW}"><div class="r-total-lbl" style="grid-column:span 5">Grand Total</div><div class="r-total-val">${fmt(nv(s.advance))}</div><div class="r-total-val">${fmt(bal)}</div><div class="r-total-val">${fmt(total)}</div></div><div class="r-grand"><div class="r-grand-lbl">AMOUNT PAYABLE</div><div class="r-grand-val">${fmt(total)}</div></div><div style="padding:8px 12px;font-size:10px;font-style:italic;color:var(--color-text-secondary);background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary)">Payment mode: ${s.paymode||'—'} · Balance due: ${fmt(bal)} · ${s.notes||'No additional notes'}</div><div class="r-sig"><div class="r-sig-hdr">Accountant</div><div class="r-sig-hdr">Branch Head</div><div class="r-sig-hdr">Director / Founder</div></div><div class="r-sig"><div class="r-sig-body"></div><div class="r-sig-body"></div><div class="r-sig-body"></div></div><div class="r-sig"><div class="r-sig-foot">Accountant Sign.</div><div class="r-sig-foot">Check Head Sign.</div><div class="r-sig-foot">Authorised Signatory</div></div>`;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-receipt-view').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
}

loadFromSheet();
function logout(){
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login/login.html";
}