# Profile Wall Feature

## Overview
Users can now visit other users' profiles and leave messages/comments on their profile wall.

## Features Implemented

### 1. Profile Wall Component (`src/components/ProfileWall.tsx`)
- **Real-time updates**: Wall posts update automatically when new messages are posted
- **Input validation**: 
  - Messages must be 1-1000 characters
  - Client-side validation using Zod schema
  - Proper error handling and user feedback
- **Security**:
  - Users cannot post on their own walls
  - RLS policies enforce proper access control
  - Input sanitization is handled by database triggers
- **Features**:
  - Post messages with character counter (max 1000)
  - View all wall posts with timestamps
  - Delete own posts or posts on your wall
  - Avatar and username display for each poster
  - Empty state when no messages exist

### 2. Integration with User Collection Page
- Profile wall is displayed at the bottom of the `/collection/:userId` page
- Shows below the user's spider collection
- Fully responsive design

### 3. UserProfileModal Enhancement
- Added "View Full Profile" button to navigate to full profile page
- Button navigates to `/collection/:userId` route

## Database & Security

### Existing Table: `profile_wall_posts`
- Columns: `id`, `profile_user_id`, `poster_user_id`, `message`, `created_at`, `updated_at`
- Already has proper RLS policies:
  - Users can post on others' walls (not their own)
  - All posts are viewable
  - Users can update their own posts
  - Users can delete own posts OR posts on their wall

### Database Triggers
- `trigger_sanitize_wall_post_message()`: Automatically sanitizes message content
- `update_updated_at_column()`: Auto-updates timestamps

## User Flow

1. **Navigate to Profile**:
   - Click username anywhere in the app
   - Opens `UserProfileModal`
   - Click "View Full Profile" button
   - Navigates to `/collection/:userId`

2. **View Wall Posts**:
   - Scroll to bottom of profile page
   - See all messages left by other users
   - Posts show poster's avatar, name, message, and timestamp

3. **Post Message**:
   - If viewing another user's profile, see textarea
   - Type message (1-1000 characters)
   - Character counter updates in real-time
   - Click "Post Message"
   - Message appears immediately with real-time updates

4. **Delete Messages**:
   - Own messages: Trash icon visible
   - Messages on your wall: Trash icon visible
   - Click to delete

## Security Features

✅ **Input Validation**: Zod schema validation on client-side
✅ **Length Limits**: 1-1000 characters enforced
✅ **RLS Policies**: Server-side access control
✅ **Sanitization**: Database triggers clean input
✅ **No Self-Posting**: Users blocked from posting on own walls
✅ **Real-time Updates**: Automatic refresh when posts change

## Navigation Points

Users can access profiles from:
- Leaderboard (username clicks)
- Battle challenges (username clicks)
- Wall posts (username clicks via `ClickableUsername`)
- Battle history (username mentions)
- Any `ClickableUsername` component throughout the app

## Technical Implementation

### Technologies Used
- **React** with TypeScript
- **Supabase** for real-time database
- **Zod** for input validation
- **date-fns** for timestamp formatting
- **Framer Motion** for animations
- **Tailwind CSS** for styling

### Key Components
1. `ProfileWall.tsx` - Main wall component
2. `UserCollection.tsx` - Profile page with wall
3. `UserProfileModal.tsx` - Quick profile view with navigation
4. `ClickableUsername.tsx` - Reusable username link component

## Future Enhancements (Optional)

- Like/react to wall posts
- Reply threads on posts
- Mention notifications
- Rich text formatting
- Image/media attachments
- Pin important posts
- Report inappropriate content
