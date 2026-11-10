/**
 * Ringgrid 2.3 Firebase adapter.
 * Uses NEW rg23_* collections, never the legacy Ringgrid v1 collection.
 * GitHub Pages mode: anonymous judges + Firebase-email/password Admins.
 * Requirements: Firestore rules, Anonymous Auth and Email/Password Auth, rg23_admins/{ADMIN_UID}.
 */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, addDoc} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const bridge=window.RinggridBridge;
const $=id=>document.getElementById(id);
const enabled=(location.protocol==='https:'||new URLSearchParams(location.search).get('live')==='1')&&firebaseConfig?.projectId;
let db,auth,unsubTournament=null,unsubPrivate=null,unsubPublic=null,unsubCheckins=null,unsubRegistrations=null;
let isAdmin=false,activeTournamentId=null,fullSnapshot=null,publicSnapshot=null,checkedInIds=new Set();
let savesInFlight=Promise.resolve(),saveTimer=null,remoteApplication=false,unsubPhone=null;
const base='rg23_tournaments',adm='rg23_admins';
const errText=e=>e?.code?`${e.code}: ${e.message||''}`:e?.message||String(e);
function badge(text,color=''){$('connectionBadge').textContent=text;$('connectionBadge').className='demo '+color}
function throwIfNotAdmin(){if(!isAdmin||!auth.currentUser||auth.currentUser.isAnonymous)throw Error('An authorized Firebase Admin sign-in is required.')}
const tournamentRef=id=>doc(db,base,id);
const privateRef=id=>doc(db,base,id,'private','state');
const publicRef=id=>doc(db,base,id,'public','state');
const checkinRef=(id,jid)=>doc(db,base,id,'checkins',jid);
const regRef=(id,rid)=>doc(db,base,id,'registrations',rid);
const safePublic=s=>({judges:s.judges.map(j=>({id:j.id,name:j.name,rank:j.rank,division:j.division,ring:j.ring||null,slot:j.slot??0,response:j.response||'none',checkedIn:!!j.checkedIn,competing:!!j.competing,eligibleToCompete:j.eligibleToCompete!==false,completedDivisions:j.completedDivisions||[],ringsJudged:j.ringsJudged||0,hasCompeted:!!j.hasCompeted,notifications:[]})),rings:(s.rings||[]).map(r=>({...r})),archivedRings:[],competitionLedger:[],pending:[],activity:[],seq:s.seq||1});
function mergePresence(snapshot){if(!snapshot)return snapshot;const s=structuredClone(snapshot);for(const j of s.judges||[])j.checkedIn=checkedInIds.has(j.id);return s}
function displayRemote(){const data=isAdmin?fullSnapshot:publicSnapshot;if(!data)return;bridge.applyRemoteState(mergePresence(data));}
function clearSubscriptions(){for(const unsub of [unsubTournament,unsubPrivate,unsubPublic,unsubCheckins,unsubRegistrations,unsubPhone])if(unsub)unsub();unsubTournament=unsubPrivate=unsubPublic=unsubCheckins=unsubRegistrations=unsubPhone=null;fullSnapshot=publicSnapshot=null;checkedInIds=new Set()}

async function ensureAdmin(){const user=auth.currentUser;if(!user||user.isAnonymous){isAdmin=false;return false}
 const r=await getDoc(doc(db,adm,user.uid));isAdmin=!!r.exists()&&r.data()?.role==='admin';return isAdmin}
async function login(email,password){if(!enabled)throw Error('Firebase Live is not enabled on this address.');if(!email||!password)throw Error('Enter your Admin email and password.');
 const credential=await signInWithEmailAndPassword(auth,email,password);const okay=await ensureAdmin();if(!okay){await signOut(auth);await signInAnonymously(auth);throw Error('This account is not authorized in rg23_admins. Add your Firebase UID as an Admin in Firestore.')}
 bridge.setAdminAuthed(true);$('loginUser').value=email;badge('● FIREBASE LIVE · ADMIN','live-status');if(activeTournamentId)attachPrivate(activeTournamentId);return credential.user}
async function logout(){clearPrivileged();isAdmin=false;bridge.setAdminAuthed(false);await signOut(auth);await signInAnonymously(auth);if(activeTournamentId)displayRemote();badge('● FIREBASE LIVE · JUDGE','live-status')}
function clearPrivileged(){if(unsubPrivate)unsubPrivate();if(unsubRegistrations)unsubRegistrations();if(unsubPhone)unsubPhone();unsubPrivate=unsubRegistrations=unsubPhone=null;fullSnapshot=null}

function attachPrivate(id){clearPrivileged();if(!isAdmin||!id)return;
 unsubPrivate=onSnapshot(privateRef(id),snapshot=>{if(!snapshot.exists())return;fullSnapshot=snapshot.data().state;displayRemote();},error=>badge('● PRIVATE DATA ERROR: '+errText(error),'error-status'));
 unsubRegistrations=onSnapshot(collection(db,base,id,'registrations'),snap=>{const pending=snap.docs.map(d=>d.data());bridge.setPending?.(pending)},error=>badge('● REGISTRATION READ ERROR: '+errText(error),'error-status'));
}
function selectTournament(id){clearSubscriptions();activeTournamentId=id;unsubPublic=onSnapshot(publicRef(id),snap=>{if(snap.exists()){publicSnapshot=snap.data().state;displayRemote()}},error=>badge('● PUBLIC DATA ERROR: '+errText(error),'error-status'));
 unsubCheckins=onSnapshot(collection(db,base,id,'checkins'),snap=>{checkedInIds=new Set(snap.docs.filter(d=>d.data().checkedIn).map(d=>d.id));displayRemote()},error=>badge('● CHECK-IN ERROR: '+errText(error),'error-status'));
 if(isAdmin)attachPrivate(id)}
function leaveTournament(){clearSubscriptions();activeTournamentId=null}

async function createTournament(details,initialState){throwIfNotAdmin();const id='rg-'+crypto.randomUUID().slice(0,20);const batch=writeBatch(db);
 batch.set(tournamentRef(id),{...details,id,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
 batch.set(privateRef(id),{state:initialState,updatedAt:serverTimestamp()});
 batch.set(publicRef(id),{state:safePublic(initialState),updatedAt:serverTimestamp()});
 await batch.commit();return id}

// Admin writes are coalesced so consecutive drag/drop actions don't flood a document.
function saveAdminState(id,state){if(!enabled||!isAdmin||!id)return;fullSnapshot=structuredClone(state);
 if(saveTimer)clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{const snapshot=structuredClone(fullSnapshot);savesInFlight=savesInFlight.then(async()=>{
  const batch=writeBatch(db);batch.set(privateRef(id),{state:snapshot,updatedAt:serverTimestamp()});batch.set(publicRef(id),{state:safePublic(snapshot),updatedAt:serverTimestamp()});await batch.commit();
 }).catch(e=>badge('● SAVE ERROR: '+errText(e),'error-status'));},220)}
async function setCheckin(id,judgeId,yes){if(!auth.currentUser)throw Error('Not signed in to Firebase');
 if(yes){await setDoc(checkinRef(id,judgeId),{judgeId,checkedIn:true,authUid:auth.currentUser.uid,at:serverTimestamp()});}
 else{throwIfNotAdmin();await deleteDoc(checkinRef(id,judgeId))}}
async function submitRegistration(id,pending){if(!auth.currentUser)throw Error('Not connected to Firebase');await setDoc(regRef(id,pending.id),{...pending,submittedBy:auth.currentUser.uid,createdAt:serverTimestamp()});}
async function deleteRegistration(id,pendingId){throwIfNotAdmin();await deleteDoc(regRef(id,pendingId))}
async function requestPhoneUpdate(id,judgeId,phone){if(!auth.currentUser)throw Error('Not connected to Firebase');await addDoc(collection(db,base,id,'phoneUpdates'),{judgeId,phone,by:auth.currentUser.uid,at:serverTimestamp()})}
function cleanText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function showPhoneRequests(id){throwIfNotAdmin();const snap=await getDocs(collection(db,base,id,'phoneUpdates'));let html='<h3>Phone Number Updates</h3><p class="muted">Approve changes before replacing a judge\'s saved number.</p>';
 html+=snap.empty?'<p>No pending phone updates.</p>':snap.docs.map(d=>{const v=d.data();return `<div class="modal-row"><strong>${cleanText(v.judgeId)}</strong> · ${cleanText(v.phone)}<button data-approve-phone="${d.id}" data-judge-id="${cleanText(v.judgeId)}" data-phone="${cleanText(v.phone)}">Approve Update</button></div>`}).join('');bridge.showModal?.(html)}
async function approvePhone(id,requestId,judgeId,phone){throwIfNotAdmin();bridge.applyPhoneUpdate(judgeId,phone);await deleteDoc(doc(db,base,id,'phoneUpdates',requestId));await showPhoneRequests(id)}
document.addEventListener('click',e=>{let target=e.target.closest('[data-approve-phone]');if(target){approvePhone(activeTournamentId,target.dataset.approvePhone,target.dataset.judgeId,target.dataset.phone).catch(e=>bridge.notify(errText(e)))}});

window.RinggridLive={enabled:!!enabled,isAdmin:()=>isAdmin,login,logout,selectTournament,leaveTournament,createTournament,saveAdminState,setCheckin,submitRegistration,deleteRegistration,requestPhoneUpdate,showPhoneRequests};

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
