# Quick Reference Guide

Fast reference for common tasks and commands.

## 🚀 Start Development

```bash
# Terminal 1 - Backend
cd apps/api
uvicorn main:app --reload

# Terminal 2 - Frontend
cd apps/web
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📦 Install Dependencies

```bash
# Frontend (one-time)
cd apps/web
npm install

# Backend (one-time)
cd apps/api
pip install -r requirements.txt

# Or install specific new packages:
pip install google-auth-oauthlib google-api-python-client supabase
```

## 🔑 Environment Variables

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### Backend (`.env`)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_API_KEY=AIzaSyxxx
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback
```

## 🗄️ Database Setup

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste contents of:
apps/api/migrations/001_create_integrations_tables.sql
```

**Create Storage Bucket:**
1. Go to Supabase Dashboard → Storage
2. Create bucket: `reels`
3. Set Public: ✅ Yes

## 🔗 Google OAuth Setup

1. Go to: https://console.cloud.google.com
2. Create/select project
3. Enable: **Google Drive API**
4. Credentials → Create OAuth 2.0 Client
5. Add redirect URI: `http://localhost:8000/api/integrations/google/callback`
6. Copy Client ID and Secret

## 🧪 Quick Tests

### Test Backend
```bash
# Health check
curl http://localhost:8000/api/health

# OAuth URL
curl "http://localhost:8000/api/integrations/google/login?user_id=test"

# List reels
curl http://localhost:8000/api/reels/list
```

### Test Frontend
1. Visit: http://localhost:3000/login
2. Sign up with test account
3. Visit: http://localhost:3000/settings/integrations
4. Visit: http://localhost:3000/reels

## 📁 Key Files

### Backend
```
apps/api/
├── main.py                    # Entry point
├── routers/
│   ├── integrations.py       # Google Drive
│   └── reels.py              # Reels upload
├── models/
│   ├── integrations.py       # Pydantic models
│   └── reels.py              # Pydantic models
└── utils/
    └── supabase_client.py    # DB connection
```

### Frontend
```
apps/web/
├── app/
│   ├── login/page.tsx         # Auth page
│   ├── reels/page.tsx         # Reels list
│   └── settings/integrations/page.tsx  # Drive sync
├── components/
│   ├── reels/UploadModal.tsx  # Upload modal
│   └── auth/ProtectedRoute.tsx # Auth wrapper
└── hooks/
    └── use-auth.ts            # Auth hook
```

## 🎨 UI Components

```tsx
// Login/Signup
import Link from "next/link";
<Link href="/login">Sign In</Link>

// Protected Page
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
<ProtectedRoute>
  <YourContent />
</ProtectedRoute>

// Upload Modal
import { UploadModal } from "@/components/reels/UploadModal";
<UploadModal
  open={isOpen}
  onOpenChange={setIsOpen}
  onUploadComplete={() => console.log("Done!")}
/>

// Auth Hook
import { useAuth } from "@/hooks/use-auth";
const { user, loading, isAuthenticated, signOut } = useAuth();

// Toast Notification
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({
  title: "Success",
  description: "Operation completed!",
});
```

## 🔌 API Calls

### Google Drive Integration
```typescript
// Get OAuth URL (backend redirects)
window.location.href = `${API_URL}/api/integrations/google/login?user_id=${userId}`;

// Sync Drive files
const response = await fetch(
  `${API_URL}/api/integrations/drive/sync?user_id=${userId}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: null }),
  }
);
```

### Reels Upload
```typescript
const formData = new FormData();
formData.append("file", videoFile);
formData.append("user_id", userId);
formData.append("title", "My Video");

const response = await fetch(`${API_URL}/api/reels/upload`, {
  method: "POST",
  body: formData,
});
```

### Supabase Queries
```typescript
// Fetch Drive files
const { data, error } = await supabase
  .from("drive_files")
  .select("*")
  .eq("user_id", userId)
  .order("synced_at", { ascending: false });

// Check integration status
const { data } = await supabase
  .from("google_integrations")
  .select("*")
  .eq("user_id", userId)
  .single();
```

## 🐛 Common Issues

### "Module not found: @/lib/supabase/client"
```bash
cd apps/web
npm install @supabase/supabase-js
npm run dev
```

### "Missing Supabase credentials"
```bash
# Check .env files exist:
ls apps/web/.env.local
ls apps/api/.env

# Verify variables are set:
cat apps/web/.env.local | grep SUPABASE
```

### "OAuth redirect not working"
```bash
# Check backend is running:
curl http://localhost:8000/api/health

# Verify redirect URI in Google Console matches exactly:
# http://localhost:8000/api/integrations/google/callback
```

### "CORS error"
```bash
# In apps/api/.env, set:
ALLOWED_ORIGINS=*

# Restart backend:
cd apps/api
uvicorn main:app --reload
```

## 📊 Database Queries

### Check Integration Status
```sql
SELECT * FROM google_integrations WHERE user_id = 'your-user-id';
```

### List Synced Files
```sql
SELECT name, mime_type, synced_at, is_processed 
FROM drive_files 
WHERE user_id = 'your-user-id' 
ORDER BY synced_at DESC;
```

### List Reels
```sql
SELECT title, views, likes, created_at 
FROM reels 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🔍 Debugging

### Backend Logs
```bash
# Check backend console for errors
# Look for 500 errors, stack traces

# Test individual endpoints:
curl -v http://localhost:8000/api/health
```

### Frontend Logs
```javascript
// Open browser console (F12)
// Check for:
// - Network errors (failed requests)
// - Console errors (JavaScript errors)
// - CORS issues
```

### Supabase Logs
```bash
# Go to: https://app.supabase.com
# Select project → Logs → API
# Check for failed queries, auth errors
```

## 📚 Documentation Links

- **Full Setup**: `SETUP_GUIDE.md`
- **Backend API**: `apps/api/INTEGRATIONS.md`
- **Frontend UI**: `apps/web/FRONTEND_GUIDE.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`

## 🎯 Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can create account at `/login`
- [ ] Can sign in at `/login`
- [ ] Can connect Google Drive at `/settings/integrations`
- [ ] Can sync Drive files
- [ ] Files appear in list
- [ ] Can open upload modal at `/reels`
- [ ] Can upload video
- [ ] Video appears in reels list

## 💡 Pro Tips

1. **Use API Docs**: Visit http://localhost:8000/docs for interactive API testing
2. **Check Supabase Dashboard**: Monitor tables, storage, and auth in real-time
3. **Enable Debug Mode**: Set `DEBUG=True` in backend for detailed errors
4. **Use React DevTools**: Install browser extension for component debugging
5. **Watch Network Tab**: Monitor API calls in browser DevTools

## 🚦 Status Indicators

### Green = Working ✅
- API returns 200 status
- UI shows success toast
- Data appears in Supabase

### Yellow = Check ⚠️
- 400 errors (bad request - check parameters)
- Auth errors (sign in again)
- CORS warnings (check backend config)

### Red = Broken ❌
- 500 errors (backend issue)
- Connection refused (server not running)
- TypeScript errors (npm install)

---

**Keep this file handy for quick reference during development!**
