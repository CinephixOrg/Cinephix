# Group Chat Testing Guide

## Quick Test Steps

### Test 1: Groups appear in Messages sidebar

**Prerequisites:**
- Two user accounts (User A, User B)
- At least one group both users can join

**Steps:**
1. User A opens Community tab
2. User A finds a group and clicks "Join"
3. User A opens Messages tab
4. ✅ **Expected:** Group appears in conversation list (at top if it has recent messages)
5. ✅ **Should show:** Group name, group cover image (or first letter), last message preview, timestamp
6. User B repeats steps 1-3
7. ✅ **Expected:** Same group appears in User B's Messages

**What to check:**
- Group appears in list (not just conversations)
- Group is sorted by most recent message at top
- Group shows unread count badge if applicable
- Group name and image are correct

---

### Test 2: Send message in group chat

**Prerequisites:**
- Group from Test 1
- Both users joined

**Steps:**
1. User A opens Messages → clicks on group
2. ✅ **Expected:** ChatWindow opens showing group chat
3. ✅ **Should show:** Group name in header, group cover image
4. User A types a message and sends
5. ✅ **Expected:** Message appears in chat
6. User B's Messages list updates in real-time
7. ✅ **Expected:** Group moves to top of list
8. ✅ **Expected:** User B sees unread badge on group (e.g., badge "1")
9. User B clicks on group to open
10. ✅ **Expected:** Unread badge disappears, markAsRead called

**What to check:**
- Message displays with correct sender
- Message shows timestamp
- Real-time Socket.IO update happens (group moves to top for User B)
- Unread count badge appears for other members
- Unread count clears when chat opened

---

### Test 3: Unread count tracking

**Prerequisites:**
- Group with User A and User B

**Steps:**
1. User A sends message in group
2. User B is NOT in the Messages tab (on different page)
3. ✅ **Expected:** User B still sees unread badge on group when they open Messages
4. User B clicks on group
5. ✅ **Expected:** Badge clears immediately
6. User B opens different page, then comes back to Messages
7. ✅ **Expected:** No badge (unread was cleared)
8. User A sends another message
9. ✅ **Expected:** Badge re-appears for User B

**What to check:**
- Unread count accurate
- Persists even if user navigates away
- Clears when markAsRead endpoint called
- Re-increments on new messages

---

### Test 4: DM functionality still works

**Prerequisites:**
- Two users who have an existing DM conversation
- Plus a group they're both in

**Steps:**
1. Both users open Messages
2. ✅ **Expected:** Both DMs AND groups visible in same list
3. ✅ **Expected:** Most recent (DM or group) at top
4. User A sends DM to User B
5. ✅ **Expected:** DM moves to top, group below it
6. DM should have type indicator (can inspect in console)
7. Group should have type indicator

**What to check:**
- DMs and groups mixed in single list
- DM avatar/name different from group cover/name
- Sorting works with both types together
- DM unread counts work independently

---

### Test 5: Multiple groups

**Prerequisites:**
- User in 3+ groups
- Some with recent messages

**Steps:**
1. User opens Messages
2. ✅ **Expected:** All groups listed
3. ✅ **Expected:** Sorted by most recent message
4. Different group members send messages
5. ✅ **Expected:** Groups with new messages move to top
6. ✅ **Expected:** Unread badges update correctly per group
7. User opens one group, then another
8. ✅ **Expected:** Previous group's badge clears, new group's badge clears

**What to check:**
- Multiple groups all visible
- Sorting consistent
- Unread counts independent per group
- markAsRead only affects clicked group

---

### Test 6: Group info in chat header

**Prerequisites:**
- Open group chat

**Steps:**
1. Look at ChatHeader when group is open
2. ✅ **Expected:** Shows group name (not "User A" or other username)
3. ✅ **Expected:** Shows group cover image (or first letter avatar)
4. ✅ **Expected:** Shows back button on mobile
5. Close group and open DM
6. ✅ **Expected:** Header switches to show username and user avatar

**What to check:**
- Header content changes based on type
- Group image/name displayed correctly
- DM user info displayed correctly

---

### Test 7: Message persistence

**Prerequisites:**
- Group with existing messages

**Steps:**
1. User opens group chat
2. ✅ **Expected:** Previous messages load and display
3. Scroll up (if multiple messages)
4. ✅ **Expected:** Earlier messages load correctly
5. Close and reopen group
6. ✅ **Expected:** Same messages displayed
7. Close and navigate to different conversation
8. Open original group again
9. ✅ **Expected:** Same messages, no duplicates

**What to check:**
- Messages load from database correctly
- Message order correct (oldest first when loaded)
- No duplicate messages
- Proper message limit (50 messages shown)

---

## Debugging Commands (Browser Console)

```javascript
// Check conversation type
conversations[0].type  // Should be 'dm' or 'group'

// Check unread count
conversations[0].unreadCount  // Should be number

// Check if group fields present
conversations[0].name         // For groups
conversations[0].coverImage   // For groups
conversations[0].otherUser    // For DMs only

// Check Socket.IO connection
socket.connected  // Should be true

// Monitor Socket.IO events
socket.on('conversation-updated', (payload) => {
  console.log('Conversation updated:', payload);
});
```

---

## Common Issues & Solutions

### Issue: Group doesn't appear in Messages after joining

**Possible Causes:**
1. Page not refreshed after joining
   - **Solution:** Refresh the page or navigate away and back to Messages

2. Group has no `lastMessageAt` timestamp
   - **Solution:** Send a message in the group from backend/frontend
   - Check Group document in MongoDB: `lastMessageAt` should be a Date

3. User not actually added to group members
   - **Solution:** Check Group document in MongoDB, verify user._id in members array

### Issue: Unread badge doesn't appear

**Possible Causes:**
1. Message was sent before group integration
   - **Solution:** Send a new message after implementation

2. `unreadCounts` field missing from Group
   - **Solution:** Check Group model has Map<userId, Number> field

3. Socket.IO 'conversation-updated' not emitting
   - **Solution:** Check chatSocket.js has group message handling
   - Verify Socket.IO is connected and in correct room

### Issue: markAsRead endpoint returns 403

**Possible Causes:**
1. User not actually a member
   - **Solution:** User must be in group.members array

2. GroupId wrong or invalid ObjectId
   - **Solution:** Verify ID is valid MongoDB ObjectId

### Issue: Messages not loading in ChatWindow

**Possible Causes:**
1. getMessages endpoint returning error
   - **Solution:** Check endpoint tries both Conversation and Group lookups
   - Verify Message documents have correct roomType and roomId

2. DMPage not passing roomType correctly
   - **Solution:** Check `roomType={activeConv?.type === 'group' ? 'group' : 'dm'}`

3. useChat hook not initialized correctly
   - **Solution:** Check ChatWindow passes roomType to useChat
   - Verify useChat is subscribed to correct Socket.IO room

---

## API Endpoints Involved

### GET /api/conversations
**Purpose:** Get all DMs and groups
**Response:** Array of objects with type: "dm"|"group"

### GET /api/conversations/:id/messages
**Purpose:** Get messages for conversation or group
**Note:** Now generic - works for both IDs

### POST /api/conversations/:id/read
**Purpose:** Mark DM as read
**Note:** Used for DMs only

### POST /api/groups/:groupId/markAsRead
**Purpose:** Mark group as read
**Note:** NEW endpoint for groups

### Socket.IO Events

**Emit (server to clients):**
- `conversation-updated` - When DM or group has new message
  - Payload: `{ conversationId|groupId, lastMessage, lastMessageAt, senderId }`

**Listen (client):**
- `conversation-updated` - Updates local conversation state
- `new-message` - New message in active room

---

## Performance Notes

- Group lookup uses index: `{ "members.user": 1, lastMessageAt: -1 }`
- Unread counts use Map for O(1) lookup per user
- Messages limited to 50 most recent
- All queries use `.lean()` for better performance

---

## Data Structures

### Conversation (DM) Response
```javascript
{
  _id: ObjectId,
  type: "dm",
  participants: [User],
  lastMessage: String,
  lastMessageAt: Date,
  unreadCounts: Map<userId, Number>,
  otherUser: User,  // Added by controller
  unreadCount: Number  // Current user's unread count
}
```

### Group Response
```javascript
{
  _id: ObjectId,
  type: "group",
  name: String,
  slug: String,
  description: String,
  coverImage: String,
  members: [{user: ObjectId}],
  lastMessage: String,
  lastMessageAt: Date,
  lastMessageSenderId: ObjectId,
  unreadCounts: Map<userId, Number>,
  unreadCount: Number  // Current user's unread count
}
```

### Message (both types)
```javascript
{
  _id: ObjectId,
  roomType: "dm"|"group",
  roomId: ObjectId,  // Conversation or Group _id
  sender: ObjectId,
  text: String,
  createdAt: Date
}
```

---

## Expected Timeline for Full Feature

1. ✅ User joins group via Community → group in database
2. ✅ User opens Messages → getConversations returns group
3. ✅ GroupItem renders in conversation list
4. ✅ User clicks group → openConversation processes it
5. ✅ Messages load via generic getMessages endpoint
6. ✅ ChatWindow opens with correct roomType
7. ✅ Group member sends message → Socket.IO fires
8. ✅ Other members' unread counts increment
9. ✅ Other members see 'conversation-updated' event
10. ✅ Their messages list updates in real-time
11. ✅ Unread badge appears in real-time
12. ✅ They click group → markAsRead clears badge

Each step should happen automatically without page refresh.

---

## Success Criteria

✅ Groups appear in Messages sidebar immediately after joining
✅ Groups and DMs coexist in unified list
✅ Most recent chats appear at top regardless of type
✅ Unread counts work independently for each conversation
✅ Socket.IO real-time updates work for groups
✅ Messages load and display correctly for groups
✅ ChatHeader shows group info, not user info
✅ No errors in console
✅ All existing DM functionality unchanged
✅ Performance is acceptable (no N+1 queries, indexes used)
