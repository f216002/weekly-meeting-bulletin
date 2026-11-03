/* 每週會議快訊登入門檻（比照英文三寶讀書會 sanbao-gate.js，集合全新獨立）
   Firebase 專案：my-chinese-sentence-bank-v3（與 V4／三寶同專案，不同集合）
   申請：weekly_accessRequests/{uid}；核准：weekly_approvedUsers/{uid}
   管理員：f216002@gmail.com（免審核）
   重要限制：GitHub Pages 是靜態託管，門檻擋的是一般瀏覽；
   懂技術的人直接看公開 repo 仍看得到 index.html 內文，
   真正的「不公開」要靠不公開散佈網址＋不公開 repo＋搜尋引擎 noindex。
   因此本步驟只做門檻，不放敏感完整版；目前門檻後的內容仍是去敏感化版。 */
(function () {
  'use strict';
  var ADMIN = 'f216002@gmail.com';
  /* 重新整理鍵不依賴 Firebase，必須在最前面先接好：
     萬一 Firebase 初始化失敗導致後面提前 return，按鍵也不能跟著死掉。 */
  var utilRefreshEarly = document.getElementById('weeklyUtilRefresh');
  if (utilRefreshEarly) utilRefreshEarly.onclick = function () { location.reload(); };
  var msg = document.getElementById('weeklyGateMsg');
  var userBox = document.getElementById('weeklyGateUser');
  var signInBtn = document.getElementById('weeklySignIn');
  var applyBtn = document.getElementById('weeklyApply');
  var applyForm = document.getElementById('weeklyApplyForm');
  var applyName = document.getElementById('weeklyApplyName');
  var applyUnit = document.getElementById('weeklyApplyUnit');
  var applyDistrict = document.getElementById('weeklyApplyDistrict');
  var applySubmit = document.getElementById('weeklyApplySubmit');
  var applyCancel = document.getElementById('weeklyApplyCancel');
  var signOutBtn = document.getElementById('weeklySignOut');
  function setMsg(t) { if (msg) msg.textContent = t; }
  function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }
  function openGate() {
    document.body.classList.add('weekly-approved');
    var g = document.getElementById('weeklyGate');
    if (g) g.style.display = 'none';
  }
  var auth, db;
  try {
    if (!window.firebase) throw new Error('Firebase SDK 載入失敗');
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp({
        apiKey: 'AIzaSyChpInXumwIWaOrR4cU8KhNm1NK5-RdgQw',
        authDomain: 'my-chinese-sentence-bank-v3.firebaseapp.com',
        projectId: 'my-chinese-sentence-bank-v3',
        storageBucket: 'my-chinese-sentence-bank-v3.firebasestorage.app',
        messagingSenderId: '178850974896',
        appId: '1:178850974896:web:f1d40b2ed4e7218b553f75'
      });
    }
    auth = window.firebase.auth();
    db = window.firebase.firestore();
  } catch (e) {
    setMsg('登入功能暫時無法使用，請重新整理頁面。');
    return;
  }
  var provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  function isAdmin(user) {
    return user && String(user.email || '').toLowerCase() === ADMIN;
  }
  /* 核准檢查（全新名單，不查 V4、不查三寶）：
     管理員直接放行；weekly_approvedUsers/{uid} active=true 放行；
     weekly_accessRequests/{uid} status=pending 顯示待審核訊息（不顯示申請鍵）；
     已拒絕或未申請者顯示申請鍵。 */
  function checkApproval(user) {
    if (isAdmin(user)) { openGate(); return; }
    db.collection('weekly_approvedUsers').doc(user.uid).get().then(function (doc) {
      if (doc.exists && doc.data().active === true) { openGate(); return true; }
      return false;
    }).catch(function () { return false; }).then(function (ok) {
      if (ok) return;
      return db.collection('weekly_accessRequests').doc(user.uid).get().then(function (doc) {
        var d = doc.exists ? (doc.data() || {}) : null;
        if (d && d.status === 'pending') {
          setMsg('已登入（' + (user.email || '') + '），申請審核中，請等管理員核准後重新整理即可閱讀。');
          show(applyBtn, false);
        } else if (d && d.status === 'rejected') {
          setMsg('已登入（' + (user.email || '') + '），上次申請未通過核准。如需再次申請，請按「申請加入」。');
          show(applyBtn, true);
        } else {
          setMsg('已登入（' + (user.email || '') + '），但尚未核准。請按「申請加入」，等管理員核准後重新整理即可閱讀。');
          show(applyBtn, true);
        }
      });
    }).catch(function (err) {
      setMsg('無法確認核准狀態（' + (err.code || err.message) + '）。若你是管理員，請先到 Firebase Console 發布每週快訊規則（見 weekly-firestore-rules.txt）。');
      show(applyBtn, true);
    });
  }
  /* ---------- 後台審核面板（比照三寶後台，僅待審核＋已核准兩分頁，無統計） ----------
     入口：右上角工具列「後台審核」鍵，僅管理員可見；面板開啟時再驗一次管理員身分。 */
  var adminPanel = document.getElementById('weeklyAdminPanel');
  var adminBlocked = document.getElementById('weeklyAdminBlocked');
  var adminApp = document.getElementById('weeklyAdminApp');
  var adminReqBody = document.getElementById('weeklyReqBody');
  var adminTeacherBody = document.getElementById('weeklyTeacherBody');
  var adminReqEmpty = document.getElementById('weeklyReqEmpty');
  var adminTeacherEmpty = document.getElementById('weeklyTeacherEmpty');
  var adminReqCount = document.getElementById('weeklyReqCount');
  var adminTeacherCount = document.getElementById('weeklyTeacherCount');
  var adminToast = document.getElementById('weeklyAdminToast');
  var adminTab = 'requests';
  var currentUser = null;
  function escAdmin(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtAdminDate(ts) {
    if (!ts) return '—';
    try {
      var d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
      return d.toLocaleString('zh-TW', { hour12: false });
    } catch (_) { return '—'; }
  }
  function adminToastShow(m, isErr) {
    if (!adminToast) return;
    adminToast.textContent = m;
    adminToast.style.background = isErr ? '#8a1f1f' : '#111';
    adminToast.style.display = 'block';
    clearTimeout(adminToastShow._t);
    adminToastShow._t = setTimeout(function () { adminToast.style.display = 'none'; }, 4000);
  }
  function adminBadge(status) {
    var map = { pending: ['待審核', 'pending'], approved: ['已核准', 'approved'], rejected: ['已拒絕', 'rejected'] };
    var e = map[status] || [status || '—', ''];
    return '<span class="status-badge ' + e[1] + '">' + escAdmin(e[0]) + '</span>';
  }
  function teacherBadge(d) {
    if (d.active) return '<span class="status-badge approved">使用中</span>';
    if (d.status === 'rejected') return '<span class="status-badge rejected">已拒絕</span>';
    return '<span class="status-badge suspended">已暫停</span>';
  }
  function renderAdminRequests(snap) {
    var rows = [];
    snap.forEach(function (doc) {
      var d = doc.data() || {}; var id = doc.id;
      if (d.status !== 'pending') return;
      rows.push('<tr><td><div class="cell-main">' + escAdmin(d.name || d.displayName || '未具名') + '</div><div class="cell-sub">' + escAdmin(d.email || '') + '</div><div class="cell-sub">單位：' + escAdmin(d.unit || '—') + ' · 區別：' + escAdmin(d.district || '—') + '</div></td>' +
        '<td class="mono">' + escAdmin(id) + '</td><td>' + fmtAdminDate(d.createdAt) + '</td><td>' + adminBadge(d.status) + '</td><td class="actions">' +
        '<button type="button" data-admin-approve="' + escAdmin(id) + '">核准</button>' +
        '<button type="button" class="danger" data-admin-reject="' + escAdmin(id) + '">拒絕</button>' +
        '<button type="button" class="ghost" data-admin-del-req="' + escAdmin(id) + '">刪除</button></td></tr>');
    });
    adminReqBody.innerHTML = rows.join('');
    adminReqEmpty.style.display = rows.length ? 'none' : '';
    adminReqCount.textContent = rows.length + ' 筆';
  }
  function renderAdminTeachers(snap) {
    var rows = [];
    snap.forEach(function (doc) {
      var d = doc.data() || {}; var id = doc.id;
      rows.push('<tr><td><div class="cell-main">' + escAdmin(d.name || d.displayName || '未具名') + '</div><div class="cell-sub">' + escAdmin(d.email || '') + '</div><div class="cell-sub">單位：' + escAdmin(d.unit || '—') + ' · 區別：' + escAdmin(d.district || '—') + '</div></td>' +
        '<td class="mono">' + escAdmin(id) + '</td><td>' + fmtAdminDate(d.approvedAt) + '</td><td>' + teacherBadge(d) + '</td><td class="actions">' +
        (d.active
          ? '<button type="button" class="warn" data-admin-suspend="' + escAdmin(id) + '">暫停</button>'
          : '<button type="button" data-admin-restore="' + escAdmin(id) + '">恢復</button>') +
        '<button type="button" class="danger" data-admin-del-teacher="' + escAdmin(id) + '">刪除</button></td></tr>');
    });
    adminTeacherBody.innerHTML = rows.join('');
    adminTeacherEmpty.style.display = rows.length ? 'none' : '';
    adminTeacherCount.textContent = rows.length + ' 位';
  }
  function loadAdminLists() {
    db.collection('weekly_accessRequests').orderBy('createdAt', 'desc').get().then(renderAdminRequests).catch(function (err) {
      adminReqBody.innerHTML = ''; adminReqEmpty.style.display = '';
      adminReqEmpty.textContent = '讀取申請失敗：' + (err.code || err.message);
    });
    db.collection('weekly_approvedUsers').orderBy('approvedAt', 'desc').get().then(renderAdminTeachers).catch(function (err) {
      adminTeacherBody.innerHTML = ''; adminTeacherEmpty.style.display = '';
      adminTeacherEmpty.textContent = '讀取核准名單失敗：' + (err.code || err.message);
    });
  }
  function showAdminTab(name) {
    adminTab = name;
    document.querySelectorAll('[data-admin-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-admin-tab') === name);
    });
    document.getElementById('tabAdminRequests').hidden = name !== 'requests';
    document.getElementById('tabAdminTeachers').hidden = name !== 'teachers';
  }
  function openAdminPanel() {
    if (!adminPanel) return;
    if (!isAdmin(currentUser)) {
      adminPanel.style.display = 'block';
      if (adminBlocked) adminBlocked.style.display = '';
      if (adminApp) adminApp.style.display = 'none';
      return;
    }
    if (adminBlocked) adminBlocked.style.display = 'none';
    if (adminApp) adminApp.style.display = '';
    adminPanel.style.display = 'block';
    document.body.style.overflow = 'hidden';
    showAdminTab(adminTab);
    loadAdminLists();
  }
  function closeAdminPanel() {
    if (adminPanel) adminPanel.style.display = 'none';
    document.body.style.overflow = '';
  }
  function adminApprove(id) {
    var reqRef = db.collection('weekly_accessRequests').doc(id);
    return reqRef.get().then(function (snap) {
      if (!snap.exists) throw new Error('找不到這筆申請。');
      var d = snap.data() || {};
      if (d.status !== 'pending') throw new Error('這筆申請已經處理過了。');
      return db.collection('weekly_approvedUsers').doc(id).get().then(function (t) {
        if (t.exists && (t.data() || {}).active === true) throw new Error('此人已經在核准名單中。');
        var now = window.firebase.firestore.FieldValue.serverTimestamp();
        return db.collection('weekly_approvedUsers').doc(id).set({
          uid: d.uid || id, email: d.email || '', name: d.name || d.displayName || '',
          unit: d.unit || '', district: d.district || '',
          active: true, status: 'approved', approvedAt: now, updatedAt: now
        }).then(function () {
          return reqRef.update({ status: 'approved', updatedAt: now });
        });
      });
    }).then(function () { adminToastShow('已核准。'); loadAdminLists(); });
  }
  function adminReject(id) {
    var note = window.prompt('拒絕原因（可留空，會記在申請單上）：');
    if (note === null) return Promise.resolve();
    var update = { status: 'rejected', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (note.trim()) update.adminNote = note.trim();
    return db.collection('weekly_accessRequests').doc(id).update(update).then(function () {
      return db.collection('weekly_approvedUsers').doc(id).get();
    }).then(function (t) {
      if (t.exists) return db.collection('weekly_approvedUsers').doc(id).update({ active: false, status: 'rejected', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    }).then(function () { adminToastShow('已拒絕申請。'); loadAdminLists(); });
  }
  function adminDeleteReq(id) {
    if (!window.confirm('確定刪除這筆申請？此動作無法復原。')) return Promise.resolve();
    return db.collection('weekly_accessRequests').doc(id).delete().then(function () { adminToastShow('已刪除申請。'); loadAdminLists(); });
  }
  function adminSetTeacher(id, active) {
    return db.collection('weekly_approvedUsers').doc(id).update({
      active: active, status: active ? 'approved' : 'suspended',
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () { adminToastShow(active ? '已恢復使用權。' : '已暫停使用權。'); loadAdminLists(); });
  }
  function adminDeleteTeacher(id) {
    if (!window.confirm('確定從核准名單刪除此人？對方將立即失去閱讀權限。此動作無法復原。')) return Promise.resolve();
    return db.collection('weekly_approvedUsers').doc(id).delete().then(function () { adminToastShow('已刪除。'); loadAdminLists(); });
  }
  function adminApproveAll() {
    return db.collection('weekly_accessRequests').where('status', '==', 'pending').get().then(function (snap) {
      var jobs = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var now = window.firebase.firestore.FieldValue.serverTimestamp();
        jobs.push(db.collection('weekly_approvedUsers').doc(doc.id).set({
          uid: d.uid || doc.id, email: d.email || '', name: d.name || d.displayName || '',
          unit: d.unit || '', district: d.district || '',
          active: true, status: 'approved', approvedAt: now, updatedAt: now
        }));
        jobs.push(db.collection('weekly_accessRequests').doc(doc.id).update({ status: 'approved', updatedAt: now }));
      });
      return Promise.all(jobs);
    }).then(function () { adminToastShow('批次核准完成。'); loadAdminLists(); });
  }
  function bindAdminAction(el, attr, handler) {
    if (!el) return;
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest('[' + attr + ']');
      if (!t) return;
      handler(t.getAttribute(attr)).catch(function (err) {
        adminToastShow('操作失敗：' + ((err && err.message) || '未知錯誤'), true);
      });
    });
  }
  bindAdminAction(adminReqBody, 'data-admin-approve', adminApprove);
  bindAdminAction(adminReqBody, 'data-admin-reject', adminReject);
  bindAdminAction(adminReqBody, 'data-admin-del-req', adminDeleteReq);
  bindAdminAction(adminTeacherBody, 'data-admin-suspend', function (id) { return adminSetTeacher(id, false); });
  bindAdminAction(adminTeacherBody, 'data-admin-restore', function (id) { return adminSetTeacher(id, true); });
  bindAdminAction(adminTeacherBody, 'data-admin-del-teacher', adminDeleteTeacher);
  document.querySelectorAll('[data-admin-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      showAdminTab(b.getAttribute('data-admin-tab'));
    });
  });
  var adminApproveAllBtn = document.getElementById('weeklyApproveAll');
  if (adminApproveAllBtn) adminApproveAllBtn.addEventListener('click', function () {
    adminApproveAll().catch(function (err) { adminToastShow('批次核准失敗：' + ((err && err.message) || '未知錯誤'), true); });
  });
  var adminCloseBtn = document.getElementById('weeklyAdminClose');
  if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminPanel);
  /* ---- 內建瀏覽器偵測（比照三寶／V4） ----
     LINE / Facebook / Instagram / WeChat 等 App 內建瀏覽器會隔離儲存空間，
     Google 彈出視窗登入在裡面跑不起來（Safari 本人則可以登入）。
     偵測到就把登入鍵改為一鍵跳轉系統瀏覽器，跳不過去就顯示引導覆蓋層。 */
  function detectInAppBrowser() {
    var ua = navigator.userAgent || '';
    if (/Line\//i.test(ua)) return 'LINE';
    if (/FBAN\/|FBAV\//i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/MicroMessenger/i.test(ua)) return 'WeChat';
    return null;
  }
  function showWebviewGuide(appName, escapeAttempted) {
    var oldGuide = document.getElementById('weeklyWebviewGuide');
    if (oldGuide) oldGuide.remove();
    var siteUrl = location.origin + location.pathname;
    var overlay = document.createElement('div');
    overlay.id = 'weeklyWebviewGuide';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;max-width:420px;width:100%;' +
      'padding:24px;color:#111;font-size:16px;line-height:1.7;';
    card.innerHTML =
      '<h3 style="margin:0 0 10px;font-size:20px;">' +
      (escapeAttempted ? '沒有自動跳轉嗎？請手動開啟' : '請用 Safari / Chrome 開啟再登入') + '</h3>' +
      '<p style="margin:0 0 10px;">您正在「' + appName + '」的內建瀏覽器中，Google 登入在這裡無法使用，這是 App 本身的限制，不是網站故障。</p>' +
      '<p style="margin:0 0 6px;font-weight:700;">' +
      (escapeAttempted ? '剛才已嘗試自動開啟系統瀏覽器，若沒有反應，請這樣做：' : '請這樣做：') + '</p>' +
      '<ol style="margin:0 0 12px;padding-left:22px;">' +
      '<li>先複製本站網址（按下面按鈕）</li>' +
      '<li>iPhone 打開 Safari，Android 手機打開 Chrome</li>' +
      '<li>在網址列貼上網址，開啟網站後再登入</li>' +
      '</ol>' +
      '<p style="margin:0 0 12px;word-break:break-all;font-size:14px;color:#666;">' + siteUrl + '</p>';
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = '複製網站網址';
    copyBtn.style.cssText = 'font:inherit;cursor:pointer;border-radius:10px;border:2px solid #333;' +
      'background:#fff;color:#111;padding:10px 20px;width:100%;margin-bottom:8px;';
    var copyMsg = document.createElement('div');
    copyMsg.style.cssText = 'font-size:14px;color:#2e7d32;min-height:1.4em;margin-bottom:8px;text-align:center;';
    copyBtn.addEventListener('click', function () {
      function done(ok) {
        copyMsg.textContent = ok ? '已複製！去 Safari／Chrome 貼上開啟吧。' : '複製失敗，請長按上方網址手動複製。';
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(siteUrl).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = siteUrl;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try { done(document.execCommand('copy')); } catch (e) { done(false); }
        ta.remove();
      }
    });
    card.appendChild(copyBtn);
    card.appendChild(copyMsg);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '我知道了';
    btn.style.cssText = 'font:inherit;cursor:pointer;border-radius:10px;border:2px solid #333;' +
      'background:#111;color:#fff;padding:10px 20px;width:100%;';
    btn.addEventListener('click', function () { overlay.remove(); });
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
  function openInSystemBrowser() {
    var appName = detectInAppBrowser();
    var url = location.origin + location.pathname;
    var ua = navigator.userAgent || '';
    var target = null;
    if (/iPad|iPhone|iPod/.test(ua)) {
      target = 'x-safari-' + url;
    } else if (/Android/.test(ua)) {
      target = 'intent://' + location.host + location.pathname + '#Intent;scheme=https;end';
    }
    if (target) {
      location.href = target;
      showWebviewGuide(appName, true);
    } else {
      showWebviewGuide(appName, false);
    }
  }
  if (detectInAppBrowser() && signInBtn) {
    signInBtn.textContent = '在瀏覽器中開啟並登入';
  }
  if (signInBtn) signInBtn.onclick = function () {
    if (detectInAppBrowser()) { openInSystemBrowser(); return; }
    signInBtn.disabled = true;
    setMsg('正在開啟 Google 登入…');
    var watchdog = setTimeout(function () {
      if (!auth.currentUser) {
        signInBtn.disabled = false;
        setMsg('登入還沒有完成：如果你正在選擇帳號請繼續；如果畫面卡住了，請按右上角「重新整理」後再試，或改用 Safari／Chrome 直接開啟本站。');
      }
    }, 30000);
    auth.signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked') setMsg('彈出視窗被阻擋，請允許本網站的彈出視窗後再試一次。');
      else if (err.code === 'auth/popup-closed-by-user') setMsg('已關閉 Google 登入視窗。');
      else if (err.code === 'auth/cancelled-popup-request') setMsg('登入被中斷，請再按一次登入。');
      else if (err.code === 'auth/unauthorized-domain') setMsg('此網域尚未在 Firebase 授權，請聯繫管理員（Firebase Console → Authentication → Authorized domains 加入 f216002.github.io）。');
      else if (err.code === 'auth/operation-not-supported-in-this-environment') setMsg('請用 Safari 或 Chrome 直接開啟本網站再登入。');
      else setMsg('Google 登入失敗：' + (err.message || err.code));
    }).finally(function () {
      clearTimeout(watchdog);
      if (!auth.currentUser) signInBtn.disabled = false;
    });
  };
  /* 申請表單：姓名／單位／區別三格皆必填，寫入申請單供後台審核。 */
  function submitApplication() {
    var user = auth.currentUser;
    if (!user) return;
    var name = applyName ? applyName.value.trim() : '';
    var unit = applyUnit ? applyUnit.value.trim() : '';
    var district = applyDistrict ? applyDistrict.value.trim() : '';
    if (!name || !unit || !district) {
      setMsg('請填寫姓名、單位、區別，三格都是必填。');
      if (!name && applyName) applyName.focus();
      else if (!unit && applyUnit) applyUnit.focus();
      else if (applyDistrict) applyDistrict.focus();
      return;
    }
    db.collection('weekly_accessRequests').doc(user.uid).set({
      uid: user.uid, email: user.email || '', name: name, unit: unit, district: district,
      status: 'pending', createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      setMsg('申請已送出，請等管理員核准後重新整理頁面。');
      show(applyBtn, false); show(applyForm, false);
    }).catch(function (err) {
      if (err.code === 'permission-denied') {
        setMsg('送出失敗：你已經有一筆審核中的申請，請等管理員審核，或請管理員協助。');
      } else {
        setMsg('申請送出失敗：' + (err.code || err.message) + '（請先發布每週快訊規則）');
      }
    });
  }
  if (applyBtn) applyBtn.onclick = function () {
    var user = auth.currentUser;
    if (!user) return;
    if (applyForm && applyName) {
      show(applyBtn, false); show(applyForm, true);
      applyName.focus();
    } else {
      submitApplication();
    }
  };
  if (applyCancel) applyCancel.onclick = function () {
    show(applyForm, false); show(applyBtn, true);
  };
  if (applySubmit) applySubmit.onclick = submitApplication;
  function signOutNow() { auth.signOut(); }
  if (signOutBtn) signOutBtn.onclick = signOutNow;
  /* 右上角常駐鍵：登入／登出／重新整理。登出後必須把門檻恢復原狀：
     藏起內文、重新顯示登入門檻、收回管理員身分，否則登出等於沒登出。 */
  var utilSignIn = document.getElementById('weeklyUtilSignIn');
  var utilSignOut = document.getElementById('weeklyUtilSignOut');
  var utilUser = document.getElementById('weeklyUtilUser');
  var utilAdmin = document.getElementById('weeklyUtilAdmin');
  if (utilSignIn) utilSignIn.onclick = function () { if (signInBtn) signInBtn.click(); };
  if (utilSignOut) utilSignOut.onclick = signOutNow;
  if (utilAdmin) utilAdmin.onclick = function () { openAdminPanel(); };
  function showUtil(signedIn) {
    show(utilSignIn, !signedIn); show(utilSignOut, signedIn);
  }
  function setUtilUser(user) {
    if (!utilUser) return;
    if (!user) { utilUser.style.display = 'none'; utilUser.innerHTML = ''; return; }
    var name = user.displayName || user.email || '';
    utilUser.title = user.email || '';
    if (user.photoURL) {
      utilUser.innerHTML = '';
      var img = document.createElement('img');
      img.src = user.photoURL; img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      utilUser.appendChild(img);
    } else {
      utilUser.textContent = (name.charAt(0) || '?');
    }
    utilUser.style.display = 'flex';
  }
  if (auth.getRedirectResult) {
    auth.getRedirectResult().then(function () {}).catch(function (err) {
      setMsg('Google 登入失敗：' + ((err && err.message) || (err && err.code) || ''));
    });
  }
  auth.onAuthStateChanged(function (user) {
    currentUser = user || null;
    if (!user) {
      document.body.classList.remove('weekly-approved', 'weekly-admin');
      var g = document.getElementById('weeklyGate');
      if (g) g.style.display = '';
      setMsg('本週會快訊不公開，僅供核准成員閱讀。請先用 Google 帳號登入。');
      show(signInBtn, true); show(applyBtn, false); show(signOutBtn, false); show(applyForm, false);
      show(utilAdmin, false); closeAdminPanel(); userBox.style.display = 'none';
      showUtil(false); setUtilUser(null);
      return;
    }
    showUtil(true); setUtilUser(user);
    show(signInBtn, false); show(signOutBtn, true);
    userBox.style.display = '';
    userBox.textContent = '已登入：' + (user.displayName || '') + '（' + (user.email || '') + '）';
    if (isAdmin(user)) {
      document.body.classList.add('weekly-admin');
      show(utilAdmin, true);
      openGate();
    } else {
      show(utilAdmin, false);
      checkApproval(user);
    }
  });
})();
