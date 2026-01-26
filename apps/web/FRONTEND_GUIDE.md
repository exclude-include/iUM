# Frontend Implementation Guide

Complete guide for the authentication, Google Drive integration, and Reels upload UI.

## Table of Contents

1. [Overview](#overview)
2. [Components Created](#components-created)
3. [Setup Instructions](#setup-instructions)
4. [Usage Examples](#usage-examples)
5. [API Integration](#api-integration)
6. [Styling & Theming](#styling--theming)

## Overview

This implementation provides:
- **Authentication**: Login/Signup page with Supabase Auth
- **Google Drive Integration**: Settings page to connect and sync Drive files
- **Reels Upload**: Modal component for uploading video content
- **Protected Routes**: HOC for auth-required pages

## Components Created

### UI Components (shadcn/ui)

Located in `/apps/web/components/ui/`:

1. **dialog.tsx** - Modal dialog for overlays
2. **tabs.tsx** - Tab navigation component
3. **label.tsx** - Form label component
4. **badge.tsx** - Status and category badges

### Feature Components

#### 1. Login Page (`/app/login/page.tsx`)

Clean authentication page with tabs for Sign In and Sign Up.

**Features:**
- Email/Password authentication
- Tab switching between Sign In/Sign Up
- Form validation
- Loading states
- Toast notifications
- Auto-redirect to `/social` on success

**Usage:**
```tsx
// Navigate to /login in your app
// Users will be automatically redirected after authentication
```

#### 2. Integration Settings (`/app/settings/integrations/page.tsx`)

Google Drive connection and file management page.

**Features:**
- Connection status indicator (Connected/Disconnected)
- OAuth connection flow
- File sync with loading state
- File list display with metadata
- File type icons
- Processing status badges

**Usage:**
```tsx
// Navigate to /settings/integrations
// Click "Connect" to start OAuth flow
// Click "Sync Now" to sync Drive files
```

#### 3. Reels Upload Modal (`/components/reels/UploadModal.tsx`)

Reusable modal for video uploads.

**Features:**
- Drag & drop file upload
- File type validation (MP4, MOV, AVI, WebM)
- File size validation (max 100MB)
- Title and description inputs
- Upload progress with loading states
- Success/error handling

**Props:**
```typescript
interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}
```

**Usage:**
```tsx
import { UploadModal } from "@/components/reels/UploadModal";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Upload Reel</Button>
      <UploadModal
        open={isOpen}
        onOpenChange={setIsOpen}
        onUploadComplete={() => {
          console.log("Upload complete!");
          // Refresh your data here
        }}
      />
    </>
  );
}
```

#### 4. Reels Page (`/app/reels/page.tsx`)

Example page displaying reels with upload functionality.

**Features:**
- Grid layout of video reels
- Video player with controls
- View/like statistics
- Upload button with auth check
- Empty state messaging

#### 5. Auth Hook (`/hooks/use-auth.ts`)

Custom hook for authentication state.

**Usage:**
```tsx
import { useAuth } from "@/hooks/use-auth";

function MyComponent() {
  const { user, loading, isAuthenticated, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
```

#### 6. Protected Route (`/components/auth/ProtectedRoute.tsx`)

Wrapper component for protected pages.

**Usage:**
```tsx
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <div>Protected content here</div>
    </ProtectedRoute>
  );
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

New dependencies added:
- `@supabase/supabase-js` - Supabase client
- `@radix-ui/react-dialog` - Dialog/Modal
- `@radix-ui/react-tabs` - Tabs component
- `@radix-ui/react-label` - Form labels

### 2. Environment Variables

Create `/apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Development Server

```bash
npm run dev
```

Visit:
- Login: http://localhost:3000/login
- Integrations: http://localhost:3000/settings/integrations
- Reels: http://localhost:3000/reels

## Usage Examples

### Example 1: Adding Upload Button to Existing Page

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/reels/UploadModal";
import { Upload } from "lucide-react";

export default function MyPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUploadComplete = () => {
    console.log("Reel uploaded successfully!");
    // Refresh your data or update UI
  };

  return (
    <div>
      <Button onClick={() => setIsModalOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Video
      </Button>

      <UploadModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
```

### Example 2: Checking Auth Status

```tsx
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Example 3: Fetching Drive Files

```tsx
import { supabase } from "@/lib/supabase/client";

async function fetchUserDriveFiles(userId: string) {
  const { data, error } = await supabase
    .from("drive_files")
    .select("*")
    .eq("user_id", userId)
    .order("synced_at", { ascending: false });

  if (error) {
    console.error("Error fetching files:", error);
    return [];
  }

  return data;
}
```

## API Integration

### Authentication Flow

```
1. User visits /login
2. Enters credentials
3. supabase.auth.signInWithPassword() called
4. On success, redirect to /social
5. User session persisted automatically
```

### Google Drive Integration Flow

```
1. User visits /settings/integrations
2. Clicks "Connect" button
3. Redirects to: API_URL/api/integrations/google/login?user_id=xxx
4. User completes OAuth on Google
5. Google redirects to: API_URL/api/integrations/google/callback
6. Backend stores tokens in google_integrations table
7. User clicks "Sync Now"
8. POST /api/integrations/drive/sync
9. Files synced to drive_files table
10. UI refreshes to show files
```

### Reels Upload Flow

```
1. User opens Upload Modal
2. Drags/selects video file
3. Enters title and description
4. Clicks "Upload"
5. FormData sent to POST /api/reels/upload
6. Backend uploads to Supabase Storage
7. Metadata saved to reels table
8. Success toast shown
9. Modal closes
10. Parent component refreshes data
```

## Styling & Theming

### Dark/Light Mode

All components support automatic dark/light mode switching via the existing theme provider.

```tsx
// Theme provider already configured in layout.tsx
import { ThemeProvider } from "@/components/theme-provider";
```

### Customizing Colors

Colors are defined in `tailwind.config.ts` and use CSS variables:

```css
/* Example: Changing primary color in globals.css */
:root {
  --primary: 222.2 47.4% 11.2%;
}

.dark {
  --primary: 210 40% 98%;
}
```

### Component Styling

All components use Tailwind CSS with consistent spacing:

```tsx
// Consistent padding/margins
<Card className="p-6">        // Large card padding
<Button className="px-4 py-2"> // Button padding
<Badge className="px-2.5 py-0.5"> // Badge padding
```

## File Structure

```
apps/web/
├── app/
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── reels/
│   │   └── page.tsx              # Reels listing
│   └── settings/
│       └── integrations/
│           └── page.tsx          # Drive integration
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx   # Auth wrapper
│   ├── reels/
│   │   └── UploadModal.tsx      # Upload modal
│   └── ui/
│       ├── badge.tsx            # Badge component
│       ├── dialog.tsx           # Dialog/Modal
│       ├── label.tsx            # Form label
│       └── tabs.tsx             # Tabs component
├── hooks/
│   └── use-auth.ts              # Auth hook
└── lib/
    └── supabase/
        └── client.ts            # Supabase client
```

## Testing

### Test Authentication

1. Visit http://localhost:3000/login
2. Click "Sign Up" tab
3. Enter email/password
4. Should redirect to /social on success

### Test Google Drive Integration

1. Ensure backend is running (port 8000)
2. Visit http://localhost:3000/settings/integrations
3. Click "Connect" - should redirect to Google OAuth
4. After auth, click "Sync Now"
5. Should see files appear in the list

### Test Reels Upload

1. Visit http://localhost:3000/reels
2. Click "Upload Reel"
3. Drag/drop a video file (MP4)
4. Enter title
5. Click "Upload"
6. Should see success message and reel in list

## Common Issues

### Issue: "Missing Supabase environment variables"

**Solution:**
1. Create `.env.local` in `apps/web/`
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Restart dev server

### Issue: OAuth redirect not working

**Solution:**
1. Check `NEXT_PUBLIC_API_URL` is set correctly
2. Verify backend is running on correct port
3. Check Google Cloud Console redirect URIs

### Issue: Upload fails with CORS error

**Solution:**
1. Check backend `ALLOWED_ORIGINS` in `.env`
2. Ensure frontend origin is allowed
3. Restart backend server

### Issue: Files not showing after sync

**Solution:**
1. Check Supabase RLS policies allow reading
2. Verify user_id matches between auth and tables
3. Check browser console for errors

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch:

```tsx
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed");
  const data = await response.json();
  // Handle success
} catch (error) {
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive",
  });
}
```

### 2. Loading States

Show loading indicators for async operations:

```tsx
const [isLoading, setIsLoading] = useState(false);

// Before async operation
setIsLoading(true);
try {
  await someAsyncOperation();
} finally {
  setIsLoading(false);
}
```

### 3. Authentication Checks

Check auth before sensitive operations:

```tsx
const { user } = useAuth();

const handleUpload = () => {
  if (!user) {
    toast({
      title: "Authentication required",
      description: "Please sign in to upload.",
      variant: "destructive",
    });
    return;
  }
  // Proceed with upload
};
```

### 4. Form Validation

Validate inputs before submission:

```tsx
if (!title.trim()) {
  toast({
    title: "Missing title",
    description: "Please provide a title.",
    variant: "destructive",
  });
  return;
}
```

## Next Steps

1. **Add Profile Page**: Create user profile with settings
2. **Add Comments**: Enable commenting on reels
3. **Add Search**: Implement search for reels and files
4. **Add Filters**: Filter reels by category/date
5. **Add Notifications**: Real-time notifications for uploads
6. **Add Analytics**: Track views, likes, engagement

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **Radix UI**: https://www.radix-ui.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Next.js**: https://nextjs.org/docs

---

**Status:** All UI components implemented and ready to use! 🎉
