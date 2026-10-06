import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, writeBatch, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Replace these values with your Firebase web app config. See README.md.
const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_FIREBASE_APP_ID'
};

const $ = (id) => document.getElementById(id);
const projectDialog = $('projectDialog');
const projectForm = $('projectForm');
const formError = $('formError');
const toast = $('toast');
const addProject = $('addProject');
let auth, db, currentUser, unsubscribeProjects, allPosts = [], activeFilter = 'All';

function configured() {
  return firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' && firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function renderProjects(snapshot) {
  allPosts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderFilteredPosts();
}

function renderFilteredPosts() {
  const filtered = activeFilter === 'All' ? allPosts : allPosts.filter((post) => post.type === activeFilter);
  const list = $('projectList');
  list.replaceChildren();
  $('countAll').textContent = String(allPosts.length);
  filtered.forEach((post) => {
    const card = document.createElement('article');
    card.className = 'project-card';
    card.dataset.type = post.type || 'Lend';
    const type = document.createElement('div');
    type.className = 'project-type';
    type.textContent = ({ Lend: 'Can lend', Ask: 'Asking', Tutor: 'Tutoring', Ride: 'Ride' })[post.type] || 'Community note';
    const title = document.createElement('h3');
    title.textContent = post.title || 'Neighbourhood note';
    const location = document.createElement('div');
    location.className = 'project-location';
    const locationParts = [];
    if (post.block) locationParts.push(`Block ${post.block}`);
    if (post.room) locationParts.push(`Room ${post.room}`);
    location.textContent = `⌖ ${locationParts.join(' · ') || 'Neighbourhood'}`;
    card.append(type, title, location);
    if (post.description) {
      const description = document.createElement('p');
      description.className = 'project-description';
      description.textContent = post.description;
      card.append(description);
    }
    const by = document.createElement('div');
    by.className = 'project-by';
    const author = document.createElement('span');
    author.textContent = `Shared by ${post.author || 'a neighbour'}`;
    by.append(author);
    const report = document.createElement('button');
    report.className = 'report-button';
    report.type = 'button';
    report.textContent = 'Report';
    report.setAttribute('aria-label', `Report the post: ${post.title || 'Neighbourhood note'}`);
    report.addEventListener('click', () => reportPost(post));
    by.append(report);
    card.append(by);
    list.append(card);
  });
  $('emptyState').classList.toggle('hidden', filtered.length !== 0);
}

function listenForPosts() {
  if (unsubscribeProjects) unsubscribeProjects();
  const postsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(60));
  unsubscribeProjects = onSnapshot(postsQuery, renderProjects, (error) => {
    console.error(error);
    showToast('Could not load the board. Check the Firebase setup.');
  });
}

async function reportPost(post) {
  if (!currentUser) return showToast('Please wait a moment and try again.');
  if (!window.confirm('Report this note for review? It will be sent to the site moderator.')) return;
  try {
    const reportId = `${post.id}_${currentUser.uid}`;
    await setDoc(doc(db, 'reports', reportId), {
      postId: post.id,
      reporterUid: currentUser.uid,
      reason: 'Community concern',
      createdAt: serverTimestamp()
    }, { merge: false });
    showToast('Thanks. Your report has been sent for review.');
  } catch (error) {
    console.error(error);
    showToast(error.code === 'permission-denied' ? 'You have already reported this note.' : 'Could not send your report. Please try again.');
  }
}

addProject.addEventListener('click', async () => {
  formError.textContent = '';
  projectForm.reset();
  if (!currentUser) {
    showToast('Connecting your guest session. Please try again in a moment.');
    return;
  }
  try {
    const profileRef = doc(db, 'profiles', currentUser.uid);
    const profile = await getDoc(profileRef);
    if (profile.exists()) {
      const lastPostAt = profile.data().lastPostAt?.toDate?.();
      const wait = lastPostAt ? 60 - Math.floor((Date.now() - lastPostAt.getTime()) / 1000) : 0;
      if (wait > 0) return showToast(`For a calmer board, wait ${wait}s before posting again.`);
    }
    projectDialog.showModal();
  } catch (error) {
    console.error(error);
    showToast('Could not check your posting status. Please try again.');
  }
});

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
  renderFilteredPosts();
}));

$('closeDialog').addEventListener('click', () => projectDialog.close());
projectDialog.addEventListener('click', (event) => { if (event.target === projectDialog) projectDialog.close(); });

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const values = new FormData(projectForm);
  const submit = projectForm.querySelector('.submit-button');
  submit.disabled = true;
  formError.textContent = '';
  const profileRef = doc(db, 'profiles', currentUser.uid);
  const postRef = doc(collection(db, 'projects'));
  const timestamp = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(postRef, {
    title: String(values.get('title')).trim(),
    block: String(values.get('block')).trim(),
    room: String(values.get('room')).trim(),
    type: String(values.get('type')),
    description: String(values.get('description')).trim(),
    author: String(values.get('author')).trim(),
    uid: currentUser.uid,
    createdAt: timestamp
  });
  batch.set(profileRef, { lastPostAt: timestamp }, { merge: true });
  try {
    await batch.commit();
    projectDialog.close();
    showToast('Your note is on the community board.');
  } catch (error) {
    console.error(error);
    formError.textContent = error.code === 'permission-denied'
      ? 'Please wait a minute between posts, or check the Firebase security rules.'
      : 'Could not post your note. Check your connection and try again.';
  } finally {
    submit.disabled = false;
  }
});

if (configured()) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    listenForPosts();
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); }
        catch (error) { console.error(error); showToast('Guest access could not start. Check Firebase Anonymous sign-in setup.'); }
        return;
      }
      currentUser = user;
      addProject.disabled = false;
    });
  } catch (error) {
    console.error(error);
    showToast('Firebase setup needs attention. See the setup guide.');
  }
} else {
  addProject.addEventListener('click', () => showToast('Connect Firebase to turn on public posting. See the setup guide.'));
  $('emptyState').classList.remove('hidden');
}
