# Activity Tracking Feature - Walkthrough

## Summary
Implemented personal activity tracking for the iUM learning platform to align with the hackathon's "Personal Growth & Learning" track.

## What Was Built

### Backend (FastAPI)

#### Database Migration
- [005_create_activities_table.sql](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/migrations/005_create_activities_table.sql)
  - Creates `activities` table with: `id`, `user_id`, `event_type`, `metadata`, `created_at`
  - Indexes for efficient querying by user, date, and event type
  - RLS policies ensuring users can only access their own data

#### API Endpoints
- [activities.py](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/routers/activities.py)
  - `POST /api/activities/log` - Log activity events (cell_created, quiz_submitted, etc.)
  - `GET /api/activities/stats` - Get aggregated statistics (cells created, study time, quiz average)
  - `GET /api/activities/streak` - Get streak information (current, longest, history)

---

### Frontend (Next.js)

#### Activity Tracking Hook
- [useActivityTracker.ts](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/hooks/useActivityTracker.ts)
  - `trackCellCreated(cellType)` - Track cell creation
  - `trackQuizSubmitted(score, total)` - Track quiz completion
  - `trackChatMessage()` - Track chat messages
  - `trackDocumentUploaded()` - Track uploads
  - `activitiesApi.getStats()` / `getStreak()` - Fetch data from API

#### Stats Dashboard
- [ActivityStatsPanel.tsx](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/components/ActivityStatsPanel.tsx)
  - Streak card with flame icon and current/best streak
  - Study time stats (today/week)
  - Cells created and chat message counts
  - Weekly activity bar chart
  - Quiz average display

#### Streak Badge  
- [StreakBadge.tsx](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/components/StreakBadge.tsx)
  - Compact badge showing current streak
  - Gradient styling when active streak

---

## Integration Points

| Location | Change |
|----------|--------|
| [main.py](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/api/main.py) | Registered `/api/activities` router |
| [ProfileMenu.tsx](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/components/ProfileMenu.tsx) | Added ActivityStatsPanel to profile sheet (left sidebar avatar) |
| [ChatSidebar.tsx](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/components/views/HardView/ChatSidebar.tsx) | Integrated `trackCellCreated` and `trackChatMessage` calls |
| [FolderSidebar.tsx](file:///c:/sihyun/kaist/encode_hackathon_2/iUM/apps/web/components/views/HardView/FolderSidebar.tsx) | Added StreakBadge in folders header |

---

## UI Improvements

- Moved stats from Settings page to ProfileMenu for easier access
- Enhanced typography: larger labels (text-sm), bigger values (text-3xl), larger icons (h-4)
- Improved spacing: increased card gaps and padding for better readability
- Clean hierarchy: clear visual separation between streak card and stat grid

---

## Next Steps (Optional)

1. **Run migration**: Apply `005_create_activities_table.sql` to Supabase ✅ (completed)
2. **Test tracking**: Chat in folders to see activity data populate
3. **Check stats**: Click profile avatar to view Learning Stats dashboard
