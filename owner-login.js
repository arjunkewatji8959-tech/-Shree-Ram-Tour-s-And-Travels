// OWNER LOGIN — authenticates first, then opens the protected dashboard.
const form=document.getElementById('ownerLoginForm');
const msg=document.getElementById('ownerLoginMessage');
const password=document.getElementById('ownerPassword');
const isStaticPreview = ['localhost','127.0.0.1'].includes(location.hostname) && location.port === '5500';

// If already logged in, skip the login screen.
if(localStorage.getItem('srt_owner_token')){ window.location.href='owner.html'; }

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  msg.textContent='Checking password...';
  msg.style.color='#ffd76a';
  try{
    const res=await fetch('/api/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:password.value})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.message||'Invalid owner password.');
    localStorage.setItem('srt_owner_token',data.token);
    msg.textContent='Login successful. Opening dashboard...';
    msg.style.color='#8ff0bd';
    setTimeout(()=>window.location.href='owner.html',300);
  }catch(err){
    // VS Code Live Server (127.0.0.1:5500) does not run server.js/API routes.
    // Allow the initial password only for this local preview so the UI can be tested.
    if(isStaticPreview){
      const saved = localStorage.getItem('srt_demo_owner_password') || '895987';
      if(password.value === saved){
        localStorage.setItem('srt_owner_token','demo-owner:local-preview');
        msg.textContent='Local preview login successful. Opening dashboard...';
        msg.style.color='#8ff0bd';
        setTimeout(()=>window.location.href='owner.html',200);
        return;
      }
    }
    msg.textContent=isStaticPreview ? 'Invalid owner password.' : (err.message || 'Server/API not running.');
    msg.style.color='#ff9b9b';
  }
});
