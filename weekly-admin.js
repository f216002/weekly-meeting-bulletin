/* 每週會議快訊：管理者登入（2026-11-03 新制，取代舊的核准門檻）
   公開檢視不設門檻：任何人知道連結都能看卡片內容（noindex、robots.txt
   僅請搜尋引擎不收錄，不是真正私密；公開 repo 仍看得到檔案，見 RULES.md）。
   只有管理員 f216002@gmail.com 登入後才有編輯與分享權：
   body.weekly-admin 時才顯示 .actions、勾選圓圈、批次列、還原、已刪除；
   未登入或非管理員登入者一律只能檢視，且分享／編輯程式入口皆先檢查
   window.isWeeklyAdmin，藏按鍵之外還有程式層把關。
   本檔不使用 Firestore、不查任何核准名單；舊的 weekly_accessRequests /
   weekly_approvedUsers 集合已退役，僅供歷史參考，不再讀寫。 */
(function () {
  'use strict';
  window.isWeeklyAdmin = false;
  var ADMIN = 'f216002@gmail.com';
  var refreshBtn = document.getElementById('weeklyUtilRefresh');
  if (refreshBtn) refreshBtn.onclick = function () { location.reload(); };
  var signInBtn = document.getElementById('weeklyUtilSignIn');
  var signOutBtn = document.getElementById('weeklyUtilSignOut');
  var userChip = document.getElementById('weeklyUtilUser');
  function isAdmin(user) {
    return user && String(user.email || '').toLowerCase() === ADMIN;
  }
  function setAdmin(on) {
    window.isWeeklyAdmin = !!on;
    document.body.classList.toggle('weekly-admin', !!on);
  }
  function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }
  function setUserChip(user) {
    if (!userChip) return;
    if (!user) { userChip.style.display = 'none'; userChip.innerHTML = ''; userChip.title = ''; return; }
    var name = user.displayName || user.email || '';
    userChip.title = user.email || '';
    if (user.photoURL) {
      userChip.innerHTML = '';
      var img = document.createElement('img'); img.src = user.photoURL; img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      userChip.appendChild(img);
    } else {
      userChip.textContent = (name.charAt(0) || '?');
    }
    userChip.style.display = 'flex';
  }
  function detectInAppBrowser() {
    var ua = navigator.userAgent || '';
    if (/Line\//i.test(ua)) return 'LINE';
    if (/FBAN\/|FBAV\//i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/MicroMessenger/i.test(ua)) return 'WeChat';
    return null;
  }
  function openInSystemBrowser() {
    var appName = detectInAppBrowser() || 'App';
    var url = location.origin + location.pathname;
    var ua = navigator.userAgent || '';
    var target = null;
    if (/iPad|iPhone|iPod/.test(ua)) target = 'x-safari-' + url;
    else if (/Android/.test(ua)) target = 'intent://' + location.host + location.pathname + '#Intent;scheme=https;end';
    if (target) location.href = target;
    var old = document.getElementById('weeklyWebviewGuide');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'weeklyWebviewGuide';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;max-width:420px;width:100%;padding:24px;color:#111;font-size:16px;line-height:1.7;';
    card.innerHTML = '<h3 style="margin:0 0 10px;font-size:20px;">請用 Safari / Chrome 開啟再登入</h3>' +
      '<p style="margin:0 0 10px;">您正在「' + appName + '」的內建瀏覽器中，Google 登入在這裡無法使用，這是 App 本身的限制，不是網站故障。剛才已嘗試自動跳轉，若無反應，請複製網址到 Safari（iPhone）或 Chrome（Android）貼上開啟，再按管理者登入。</p>' +
      '<p style="margin:0 0 12px;word-break:break-all;font-size:14px;color:#666;">' + url + '</p>';
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button'; copyBtn.textContent = '複製網站網址';
    copyBtn.style.cssText = 'font:inherit;cursor:pointer;border-radius:10px;border:2px solid #333;background:#fff;padding:10px 20px;width:100%;margin-bottom:8px;';
    copyBtn.onclick = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).catch(function () {});
      else { var ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0;'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
    };
    var okBtn = document.createElement('button');
    okBtn.type = 'button'; okBtn.textContent = '我知道了';
    okBtn.style.cssText = 'font:inherit;cursor:pointer;border-radius:10px;border:2px solid #333;background:#111;color:#fff;padding:10px 20px;width:100%;';
    okBtn.onclick = function () { overlay.remove(); };
    card.appendChild(copyBtn); card.appendChild(okBtn); overlay.appendChild(card); document.body.appendChild(overlay);
  }
  var auth = null;
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
  } catch (e) {
    if (signInBtn) signInBtn.onclick = function () { alert('登入功能暫時無法使用，請重新整理頁面。'); };
    return;
  }
  var provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (detectInAppBrowser() && signInBtn) signInBtn.textContent = '在瀏覽器中開啟並登入';
  if (signInBtn) signInBtn.onclick = function () {
    if (detectInAppBrowser()) { openInSystemBrowser(); return; }
    signInBtn.disabled = true;
    var watchdog = setTimeout(function () {
      if (!auth.currentUser) { signInBtn.disabled = false; alert('登入還沒有完成：如果你正在選擇帳號請繼續；如果畫面卡住了，請按右上角「重新整理」後再試，或改用 Safari／Chrome 直接開啟本站。'); }
    }, 30000);
    auth.signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked') alert('彈出視窗被阻擋，請允許本網站的彈出視窗後再試一次。');
      else if (err.code === 'auth/popup-closed-by-user') {}
      else if (err.code === 'auth/unauthorized-domain') alert('此網域尚未在 Firebase 授權，請在 Firebase Console → Authentication → Authorized domains 加入 f216002.github.io。');
      else if (err.code === 'auth/operation-not-supported-in-this-environment') alert('請用 Safari 或 Chrome 直接開啟本網站再登入。');
      else alert('Google 登入失敗：' + (err.message || err.code));
    }).finally(function () {
      clearTimeout(watchdog);
      if (!auth.currentUser) signInBtn.disabled = false;
    });
  };
  if (signOutBtn) signOutBtn.onclick = function () { auth.signOut(); };
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      setAdmin(false); show(signInBtn, true); show(signOutBtn, false); setUserChip(null);
      if (signInBtn) signInBtn.disabled = false;
      return;
    }
    show(signInBtn, false); show(signOutBtn, true); setUserChip(user);
    if (isAdmin(user)) {
      setAdmin(true);
    } else {
      setAdmin(false);
    }
  });
})();
