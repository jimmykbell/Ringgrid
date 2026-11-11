/**
 * Ringgrid 2.3 Firebase adapter.
 * Uses NEW rg23_* collections, never the legacy Ringgrid v1 collection.
 * GitHub Pages mode: anonymous judges + Firebase-email/password Admins.
 * Requirements: Firestore rules, Anonymous Auth and Email/Password Auth, rg23_admins/{ADMIN_UID}.
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendEmailVerification, reload} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, addDoc, updateDoc} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const bridge=window.RinggridBridge;
const $=id=>document.getElementById(id);
const enabled=(location.protocol==='https:'||new URLSearchParams(location.search).get('live')==='1')&&firebaseConfig?.projectId;
let db,auth,unsubTournament=null,unsubPrivate=null,unsubPublic=null,unsubCheckins=null,unsubRegistrations=null;
let isAdmin=false,isOwner=false,activeTournamentId=null,fullSnapshot=null,publicSnapshot=null,checkedInIds=new Set();
let savesInFlight=Promise.resolve(),saveTimer=null,remoteApplication=false,unsubPhone=null,unsubRTTL=null,unsubCheckinPhones=null,privatePhones={};
const base='rg23_tournaments',adm='rg23_admins',inv='rg23_admin_invites';
const errText=e=>e?.code?`${e.code}: ${e.message||''}`:e?.message||String(e);
function badge(text,color=''){$('connectionBadge').textContent=text;$('connectionBadge').className='demo '+color}
function throwIfNotAdmin(){if(!isAdmin||!auth.currentUser||auth.currentUser.isAnonymous)throw Error('An authorized Firebase Admin sign-in is required.')}
function throwIfNotOwner(){if(!isOwner||!auth.currentUser||auth.currentUser.isAnonymous)throw Error('Only the Ringgrid Owner can create or delete tournaments. Set your account role to owner in rg23_admins.')}
const tournamentRef=id=>doc(db,base,id);
const privateRef=id=>doc(db,base,id,'private','state');
const publicRef=id=>doc(db,base,id,'public','state');
const checkinRef=(id,jid)=>doc(db,base,id,'checkins',jid);
const regRef=(id,rid)=>doc(db,base,id,'registrations',rid);
const safePublic=s=>({judges:s.judges.map(j=>({id:j.id,name:j.name,rank:j.rank,division:j.division,hasPhone:!!j.phone,ring:j.ring||null,slot:j.slot??0,response:j.response||'none',checkedIn:!!j.checkedIn,competing:!!j.competing,eligibleToCompete:j.eligibleToCompete!==false,completedDivisions:j.completedDivisions||[],ringsJudged:j.ringsJudged||0,hasCompeted:!!j.hasCompeted,notifications:[]})),rings:(s.rings||[]).map(r=>({...r})),archivedRings:[],competitionLedger:[],pending:[],activity:[],seq:s.seq||1});
function mergePresence(snapshot){if(!snapshot)return snapshot;const s=structuredClone(snapshot);for(const j of s.judges||[]){j.checkedIn=checkedInIds.has(j.id);if(isAdmin&&privatePhones[j.id]){j.phone=privatePhones[j.id];j.hasPhone=true;}}return s}
function savePrivatePhoneUpdates(){
 if(!isAdmin||!activeTournamentId||!fullSnapshot)return;
 let dirty=false;
 for(const j of fullSnapshot.judges||[]){const number=privatePhones[j.id];if(number&&j.phone!==number){j.phone=number;dirty=true;}}
 if(dirty)saveAdminState(activeTournamentId,structuredClone(fullSnapshot));
}
function displayRemote(){const data=isAdmin?fullSnapshot:publicSnapshot;if(!data)return;bridge.applyRemoteState(mergePresence(data));}
function clearSubscriptions(){for(const unsub of [unsubTournament,unsubPrivate,unsubPublic,unsubCheckins,unsubRegistrations,unsubPhone,unsubRTTL,unsubCheckinPhones])if(unsub)unsub();unsubTournament=unsubPrivate=unsubPublic=unsubCheckins=unsubRegistrations=unsubPhone=unsubRTTL=unsubCheckinPhones=null;fullSnapshot=publicSnapshot=null;checkedInIds=new Set();privatePhones={}}

async function ensureAdmin(){const user=auth.currentUser;if(!user||user.isAnonymous){isAdmin=false;isOwner=false;return false}
 const r=await getDoc(doc(db,adm,user.uid));const role=r.exists()?r.data()?.role:null;isOwner=role==='owner';isAdmin=isOwner||role==='admin';return isAdmin}
async function login(email,password){if(!enabled)throw Error('Firebase Live is not enabled on this address.');if(!email||!password)throw Error('Enter your Admin email and password.');
 const credential=await signInWithEmailAndPassword(auth,email,password);const okay=await ensureAdmin();if(!okay){const accepted=await ensureAdminInvite();if(accepted)await ensureAdmin();}
 if(!isAdmin){await signOut(auth);await signInAnonymously(auth);throw Error('This account is not authorized in rg23_admins. Add your Firebase UID as an Admin in Firestore.')}
 bridge.setAdminAuthed(true);$('loginUser').value=email;badge('● FIREBASE LIVE · ADMIN','live-status');if(activeTournamentId)attachPrivate(activeTournamentId);return credential.user}
async function logout(){clearPrivileged();isAdmin=false;isOwner=false;bridge.setAdminAuthed(false);await signOut(auth);await signInAnonymously(auth);if(activeTournamentId)displayRemote();badge('● FIREBASE LIVE · JUDGE','live-status')}
function clearPrivileged(){if(unsubPrivate)unsubPrivate();if(unsubRegistrations)unsubRegistrations();if(unsubPhone)unsubPhone();if(unsubRTTL)unsubRTTL();if(unsubCheckinPhones)unsubCheckinPhones();unsubPrivate=unsubRegistrations=unsubPhone=unsubRTTL=unsubCheckinPhones=null;fullSnapshot=null}

function attachPrivate(id){clearPrivileged();if(!isAdmin||!id)return;
 unsubPrivate=onSnapshot(privateRef(id),snapshot=>{if(!snapshot.exists())return;fullSnapshot=snapshot.data().state;savePrivatePhoneUpdates();displayRemote();},error=>badge('● PRIVATE DATA ERROR: '+errText(error),'error-status'));
 unsubRegistrations=onSnapshot(collection(db,base,id,'registrations'),snap=>{const pending=snap.docs.map(d=>d.data());bridge.setPending?.(pending)},error=>badge('● REGISTRATION READ ERROR: '+errText(error),'error-status'));
 unsubRTTL=onSnapshot(collection(db,base,id,'rttlRequests'),snap=>{bridge.setRTTLRequests?.(snap.docs.map(d=>({...d.data(),id:d.id})))},error=>badge('● RTTL READ ERROR: '+errText(error),'error-status'));
 unsubCheckinPhones=onSnapshot(collection(db,base,id,'checkinPhones'),snap=>{const next={};snap.docs.forEach(d=>{const v=d.data();if(v.judgeId&&v.phone)next[v.judgeId]=v.phone});privatePhones=next;savePrivatePhoneUpdates();displayRemote()},error=>badge('● PHONE SYNC ERROR: '+errText(error),'error-status'));
}
function selectTournament(id){clearSubscriptions();activeTournamentId=id;unsubPublic=onSnapshot(publicRef(id),snap=>{if(snap.exists()){publicSnapshot=snap.data().state;displayRemote()}},error=>badge('● PUBLIC DATA ERROR: '+errText(error),'error-status'));
 unsubCheckins=onSnapshot(collection(db,base,id,'checkins'),snap=>{checkedInIds=new Set(snap.docs.filter(d=>d.data().checkedIn).map(d=>d.id));displayRemote()},error=>badge('● CHECK-IN ERROR: '+errText(error),'error-status'));
 if(isAdmin)attachPrivate(id)}
function leaveTournament(){clearSubscriptions();activeTournamentId=null}

async function createTournament(details,initialState){throwIfNotOwner();const id='rg-'+crypto.randomUUID().slice(0,20);const batch=writeBatch(db);
 batch.set(tournamentRef(id),{...details,id,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
 batch.set(privateRef(id),{state:initialState,updatedAt:serverTimestamp()});
 batch.set(publicRef(id),{state:safePublic(initialState),updatedAt:serverTimestamp()});
 await batch.commit();return id}

// Owner-only permanent deletion of all known Ringgrid 2.3 tournament subcollections.
// Child documents must be deleted before the parent; Firestore does not cascade deletions.
async function deleteTournament(id){throwIfNotOwner();if(!id)throw Error('No tournament selected');
 if(saveTimer){clearTimeout(saveTimer);saveTimer=null}await savesInFlight;
 if(activeTournamentId===id){clearSubscriptions();activeTournamentId=null}
 const subcollections=['checkins','checkinPhones','registrations','phoneUpdates','rttlRequests','private','public'];
 for(const name of subcollections){
  const snapshot=await getDocs(collection(db,base,id,name));
  for(let i=0;i<snapshot.docs.length;i+=300){const batch=writeBatch(db);for(const document of snapshot.docs.slice(i,i+300))batch.delete(document.ref);await batch.commit()}
 }
 await deleteDoc(tournamentRef(id));
 return true;
}

// Admin writes are coalesced so consecutive drag/drop actions don't flood a document.
function saveAdminState(id,state){if(!enabled||!isAdmin||!id)return;fullSnapshot=structuredClone(state);
 if(saveTimer)clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{const snapshot=structuredClone(fullSnapshot);savesInFlight=savesInFlight.then(async()=>{
  const batch=writeBatch(db);batch.set(privateRef(id),{state:snapshot,updatedAt:serverTimestamp()});batch.set(publicRef(id),{state:safePublic(snapshot),updatedAt:serverTimestamp()});await batch.commit();
 }).catch(e=>badge('● SAVE ERROR: '+errText(e),'error-status'));},220)}
async function setCheckin(id,judgeId,yes,phone=''){
 if(!auth.currentUser)throw Error('Not signed in to Firebase');
 if(yes){const batch=writeBatch(db);
 batch.set(checkinRef(id,judgeId),{judgeId,checkedIn:true,authUid:auth.currentUser.uid,at:serverTimestamp()});
 const digits=String(phone||'').replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
 if(digits.length===10){const privatePhoneRef=doc(collection(db,base,id,'checkinPhones'));batch.set(privatePhoneRef,{judgeId,phone:digits.replace(/^(\d{3})(\d{3})(\d{4})$/,'$1-$2-$3'),submittedBy:auth.currentUser.uid,at:serverTimestamp()})}
 await batch.commit();
 }else{throwIfNotAdmin();await deleteDoc(checkinRef(id,judgeId))}
}
async function submitRegistration(id,pending){if(!auth.currentUser)throw Error('Not connected to Firebase');await setDoc(regRef(id,pending.id),{...pending,submittedBy:auth.currentUser.uid,createdAt:serverTimestamp()});}
async function deleteRegistration(id,pendingId){throwIfNotAdmin();await deleteDoc(regRef(id,pendingId))}
async function requestPhoneUpdate(id,judgeId,phone){if(!auth.currentUser)throw Error('Not connected to Firebase');await addDoc(collection(db,base,id,'phoneUpdates'),{judgeId,phone,by:auth.currentUser.uid,at:serverTimestamp()})}
function cleanText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function showPhoneRequests(id){throwIfNotAdmin();const snap=await getDocs(collection(db,base,id,'phoneUpdates'));let html='<h3>Phone Number Updates</h3><p class="muted">Approve changes before replacing a judge\'s saved number.</p>';
 html+=snap.empty?'<p>No pending phone updates.</p>':snap.docs.map(d=>{const v=d.data();return `<div class="modal-row"><strong>${cleanText(v.judgeId)}</strong> · ${cleanText(v.phone)}<button data-approve-phone="${d.id}" data-judge-id="${cleanText(v.judgeId)}" data-phone="${cleanText(v.phone)}">Approve Update</button></div>`}).join('');bridge.showModal?.(html)}
async function approvePhone(id,requestId,judgeId,phone){throwIfNotAdmin();bridge.applyPhoneUpdate(judgeId,phone);await deleteDoc(doc(db,base,id,'phoneUpdates',requestId));await showPhoneRequests(id)}
document.addEventListener('click',e=>{let target=e.target.closest('[data-approve-phone]');if(target){approvePhone(activeTournamentId,target.dataset.approvePhone,target.dataset.judgeId,target.dataset.phone).catch(e=>bridge.notify(errText(e)))}});


async function sendRTTLRequest(id,request){
 if(!auth.currentUser)throw Error('Not connected to Firebase');
 const ref=doc(db,base,id,'rttlRequests',request.id);
 await setDoc(ref,{judgeName:request.judgeName,ring:request.ring,reason:request.reason,details:request.details,status:'open',submittedBy:auth.currentUser.uid,createdAt:serverTimestamp()});
}
async function resolveRTTLRequest(id,requestId){throwIfNotAdmin();await updateDoc(doc(db,base,id,'rttlRequests',requestId),{status:'resolved',resolvedAt:serverTimestamp(),resolvedBy:auth.currentUser.uid})}
const normEmail=email=>String(email||'').trim().toLowerCase();
const emailValid=email=>/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email);
async function listAdminAccounts(){throwIfNotOwner();const [admins,invites]=await Promise.all([getDocs(collection(db,adm)),getDocs(collection(db,inv))]);return {admins:admins.docs.map(d=>({uid:d.id,...d.data()})),invites:invites.docs.map(d=>({email:d.id,...d.data()}))}}
async function showAdminManager(){
 throwIfNotOwner();
 const {admins,invites}=await listAdminAccounts();
 let html='<h3>Admin Management</h3><p class="muted">Owner-only. Invite an email address; the person creates their own Firebase login and verifies the email. They cannot create or delete tournaments.</p><form id="inviteAdminForm"><label>Invite email address<input id="inviteAdminEmail" type="email" required placeholder="staff@example.com"></label><button class="primary" type="submit">Authorize Email</button><p id="inviteAdminStatus" class="registration-message" role="status"></p></form><h4>Administrators</h4>';
 html+=admins.map(a=>`<div class="modal-row"><strong>${cleanText(a.email||a.uid)}</strong> · ${cleanText(a.role||'')}${a.role==='owner'?' (Owner)':` <button data-remove-admin="${cleanText(a.uid)}" data-admin-email="${cleanText(a.email||'')}">Revoke Admin</button>`}</div>`).join('');
 html+='<h4>Pending / Authorized Invitations</h4>'+invites.map(v=>`<div class="modal-row"><strong>${cleanText(v.email)}</strong> · ${cleanText(v.status||'active')} ${v.status==='active'?`<button data-revoke-invite="${cleanText(v.email)}">Revoke Invite</button>`:''}</div>`).join('');
 bridge.showModal?.(html);
}
async function inviteAdmin(email){throwIfNotOwner();email=normEmail(email);if(!emailValid(email))throw Error('Enter a valid email address');await setDoc(doc(db,inv,email),{email,status:'active',invitedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});return email}
async function revokeInvite(email){throwIfNotOwner();await updateDoc(doc(db,inv,normEmail(email)),{status:'revoked',updatedAt:serverTimestamp()})}
async function revokeAdmin(uid,email){throwIfNotOwner();if(uid===auth.currentUser.uid)throw Error('You cannot remove your own Owner access');const account=await getDoc(doc(db,adm,uid));if(!account.exists()||account.data().role==='owner')throw Error('Only staff Admins can be removed');const emailToRevoke=normEmail(email||account.data().email||'');if(emailToRevoke){await setDoc(doc(db,inv,emailToRevoke),{email:emailToRevoke,status:'revoked',updatedAt:serverTimestamp()},{merge:true})}await deleteDoc(doc(db,adm,uid));}
async function createInvitedAdminAccount(email,password){
 if(!enabled)throw Error('Use the live GitHub website');email=normEmail(email);if(!emailValid(email)||password.length<8)throw Error('Enter a valid invited email and password of at least 8 characters');
 const credential=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(credential.user);await signOut(auth);await signInAnonymously(auth);return email;
}
async function ensureAdminInvite(){
 const user=auth.currentUser;if(!user||user.isAnonymous||!user.email)return false;
 await reload(user);await user.getIdToken(true);if(!user.emailVerified)return false;
 try{await setDoc(doc(db,adm,user.uid),{role:'admin',email:normEmail(user.email),createdAt:serverTimestamp()});return true}catch{return false}
}
document.addEventListener('submit',async e=>{
 if(e.target.id==='inviteAdminForm'){e.preventDefault();const result=$('inviteAdminStatus');result.textContent='Authorizing…';try{const email=await inviteAdmin($('inviteAdminEmail').value);result.textContent='Email authorized: '+email+'. Send this person the Ringgrid link and ask them to select Invited as Admin under login. They must verify their email before access.';result.className='registration-message success';const link=document.createElement('a');link.href='mailto:'+email+'?subject='+encodeURIComponent('Ringgrid Admin Invitation')+'&body='+encodeURIComponent('You have been invited to help manage Ringgrid tournaments. Open '+location.origin+location.pathname+' and choose Admin Sign In → Invited as an Admin? Create your account. Verify your email, then sign in.');link.textContent='Email invitation';link.className='message-link';result.append(' ',link);}catch(err){result.textContent='Could not invite: '+errText(err);result.className='registration-message error'} }
 if(e.target.id==='adminSignupForm'){e.preventDefault();const result=$('signupStatus');result.textContent='Creating account…';try{const email=await createInvitedAdminAccount($('signupEmail').value,$('signupPassword').value);result.textContent='Verification email sent to '+email+'. Open the email link, then return and use Admin Sign In.';result.className='registration-message success'}catch(err){result.textContent=errText(err);result.className='registration-message error'}}
});
document.addEventListener('click',async e=>{
 const remove=e.target.closest('[data-remove-admin]'),revoke=e.target.closest('[data-revoke-invite]');if(!remove&&!revoke)return;
 const label=remove?.dataset.adminEmail||revoke?.dataset.revokeInvite||remove?.dataset.removeAdmin;
 if(!confirm('Revoke access for '+label+'?'))return;
 try{if(remove)await revokeAdmin(remove.dataset.removeAdmin,remove.dataset.adminEmail);else await revokeInvite(revoke.dataset.revokeInvite);await showAdminManager();}catch(err){bridge.notify('Cannot revoke: '+errText(err))}
});

window.RinggridLive={enabled:!!enabled,isAdmin:()=>isAdmin,isOwner:()=>isOwner,login,logout,selectTournament,leaveTournament,createTournament,deleteTournament,saveAdminState,setCheckin,sendRTTLRequest,resolveRTTLRequest,showAdminManager,submitRegistration,deleteRegistration,requestPhoneUpdate,showPhoneRequests};

if(enabled){
 badge('● CONNECTING FIREBASE…','');
 try{
  const app=initializeApp(firebaseConfig,'ringgrid-v23');db=getFirestore(app);auth=getAuth(app);
  await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);else if(!auth.currentUser.isAnonymous)await ensureAdmin();
  onSnapshot(collection(db,base),snap=>{bridge.setLiveMode(true);document.querySelectorAll('.local-demo-only').forEach(x=>x.hidden=true);bridge.setTournaments(snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')));badge('● FIREBASE LIVE · '+(isAdmin?'ADMIN':'JUDGE'),'live-status');
   $('loginUser').value=isAdmin?auth.currentUser?.email||'':'';$('loginUser').placeholder='Admin email';$('loginUser').type='email';$('tournamentAuthUser').placeholder='Admin email';$('tournamentAuthUser').type='email';
  },error=>{badge('● FIREBASE SETUP NEEDED · '+errText(error),'error-status');console.warn('Firebase setup:',error)});
 }catch(e){badge('● FIREBASE UNAVAILABLE · '+errText(e),'error-status');console.warn('Firebase setup:',e)}
}
